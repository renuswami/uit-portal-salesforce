public with sharing class DocumentChecklistController {

    public class DocumentWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String docType;
        @AuraEnabled public String contentDocumentId;
    }

    @AuraEnabled(cacheable=true)
    public static List<DocumentWrapper> getExistingDocuments(Id recordId) {
        if (recordId == null) return new List<DocumentWrapper>();

        // 1. Query Document__c records
        List<Document__c> docs = [
            SELECT Id, Name, Document_Type__c, ContentVersionId__c 
            FROM Document__c
            WHERE Account__c = :recordId
            ORDER BY Document_Type__c
        ];

        Set<Id> versionIds = new Set<Id>();
        
        // 2. Safely extract ContentVersion IDs and filter out bad data (Fixes Internal Server Error)
        for (Document__c doc : docs) {
            
            // Assuming ContentVersionId__c is a Text or String field.
            String cvIdString = doc.ContentVersionId__c; 
            
            if (String.isNotBlank(cvIdString)) {
                
                // Check for standard 15 or 18 character length and attempt casting
                if (cvIdString.length() == 15 || cvIdString.length() == 18) {
                    try {
                        Id contentVersionId = (Id)cvIdString;
                        versionIds.add(contentVersionId);
                    } catch (System.StringException e) {
                        // Catches errors if the string is not a valid Salesforce ID format
                        System.debug('Invalid ID format in ContentVersionId__c for Document: ' + doc.Id + '. Error: ' + e.getMessage());
                    }
                } else {
                    System.debug('Skipping ContentVersionId__c due to incorrect length: ' + cvIdString);
                }
            } 
        }
        
        // 3. Query ContentVersion records to get the ContentDocumentId
        Map<Id, Id> versionToDocIdMap = new Map<Id, Id>();
        if (!versionIds.isEmpty()) {
            try {
                for (ContentVersion cv : [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id IN :versionIds]) {
                    versionToDocIdMap.put(cv.Id, cv.ContentDocumentId);
                }
            } catch (Exception e) {
                System.debug('Error querying ContentVersion records: ' + e.getMessage());
                versionToDocIdMap = new Map<Id, Id>();
            }
        }

        // 4. Build the final results list
        List<DocumentWrapper> results = new List<DocumentWrapper>();
        for (Document__c doc : docs) { 
            DocumentWrapper wrapper = new DocumentWrapper();
            wrapper.id = doc.Id;
            wrapper.name = doc.Name;
            wrapper.docType = doc.Document_Type__c;
            
            // Safely check and assign the ContentDocumentId
            if (String.isNotBlank(doc.ContentVersionId__c)) {
                 try {
                     Id cvId = (Id)doc.ContentVersionId__c; 
                     if (versionToDocIdMap.containsKey(cvId)) {
                        wrapper.contentDocumentId = versionToDocIdMap.get(cvId);
                     }
                 } catch (System.StringException e) {
                     // Ignored as handled in step 2
                 }
            }
            results.add(wrapper);
        }

        return results;
    }

    @AuraEnabled
    public static void createDocumentRecord(Id accountId, String documentType, Id contentVersionId) {
        
        // --- 1. Find or Create Document__c record ---
        List<Document__c> docs = [
            SELECT Id FROM Document__c 
            WHERE Account__c = :accountId AND Document_Type__c = :documentType 
            LIMIT 1
        ];
        
        List<Account> Acc = [Select Name from Account where id=:accountId];
		Document__c doc;
        for(Account A:Acc){
            
        if (!docs.isEmpty()) {
             doc = docs[0];
             doc.ContentVersionId__c = contentVersionId;
             
        } else {
            doc = new Document__c(
                Account__c = accountId,
                Document_Type__c = documentType,
                Name = documentType + ' - ' + A.Name,
                ContentVersionId__c = contentVersionId
            );
            
        }
        }
        upsert doc;
        
     
        // --- 2. Get the Content Document ID ---
        ContentVersion cv = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :contentVersionId LIMIT 1];
        Id contentDocId = cv.ContentDocumentId;
        
        // --- 3. Clean up existing links ---
        // We only clean up links to the two entities we are re-inserting (Document and Account).
        List<ContentDocumentLink> existingLinks = [
            SELECT Id FROM ContentDocumentLink 
            WHERE ContentDocumentId = :contentDocId 
            AND LinkedEntityId IN (:doc.Id, :accountId)
        ];
        
        if (!existingLinks.isEmpty()) {
            try {
                delete existingLinks;
            } catch (Exception e) {
                System.debug('Warning: Could not delete existing ContentDocumentLinks: ' + e.getMessage());
            }
        }


        // --- 4. Insert the MINIMUM necessary links (Best chance of avoiding permission error) ---
        List<ContentDocumentLink> newLinks = new List<ContentDocumentLink>();

        // 1. Link to the custom Document__c record (Required for your custom object lookup)
        newLinks.add(new ContentDocumentLink(
            ContentDocumentId = contentDocId,
            LinkedEntityId = doc.Id, 
            ShareType = 'V' 
        ));
        
        // 2. Link to the parent Account record (Required for File Preview sharing across the community)
        newLinks.add(new ContentDocumentLink(
            ContentDocumentId = contentDocId,
            LinkedEntityId = accountId, 
            ShareType = 'V' 
        ));
        
        // NOTE: We REMOVED the link to UserInfo.getUserId() as it was the most likely source of the DML permission error.
        
        insert newLinks;
    }
    
    @AuraEnabled
    public static void deleteDocument(Id docRecordId) {
        // Get the Document__c record and its associated ContentVersionId
        Document__c doc = [SELECT Id, ContentVersionId__c FROM Document__c WHERE Id = :docRecordId LIMIT 1];
        if (doc.ContentVersionId__c != null) {
            try {
                // Find the ContentDocumentId
                ContentVersion cv = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :doc.ContentVersionId__c LIMIT 1];
                
                // Delete the ContentDocument, which automatically deletes all associated ContentDocumentLink records
                delete new ContentDocument(Id = cv.ContentDocumentId);
            } catch (Exception e) { 
                System.debug('File not found or deletion failed: ' + e.getMessage()); 
            }
        }
        // Delete the custom Document__c record
        delete doc;
    }

    @AuraEnabled
    public static Id finalizeFileUpload(Id contentVersionId, Id linkedEntityId) {
        
        // 1. Get the ContentDocumentId from the ContentVersion
        // The ContentDocument is the actual file record we need to link.
        ContentVersion cv = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :contentVersionId LIMIT 1];
        Id contentDocumentId = cv.ContentDocumentId;

        // 2. Insert the custom Document__c record
        // This links your custom object to the Account (Master-Detail).
        Document__c docRecord = new Document__c(
            Account__c = linkedEntityId,
            ContentVersionId__c = contentVersionId, 
            Name = 'Uploaded Document ' + System.today() // Example name
        );
        insert docRecord;

        // 3. Create the ContentDocumentLink for the Custom Document Record (Document__c)
        ContentDocumentLink docLink = new ContentDocumentLink();
        docLink.ContentDocumentId = contentDocumentId;
        docLink.LinkedEntityId = docRecord.Id; // Link the file to the Document__c record
        docLink.ShareType = 'V'; // 'V' = Viewer permission
        // CRITICAL FIX: 'AllUsers' ensures both internal and external (Community) users can see the file
        docLink.Visibility = 'AllUsers'; 
        insert docLink;
        
        // 4. (Optional but Recommended) Create the ContentDocumentLink for the Account
        // This ensures the file also appears on the Account's standard Files related list.
        ContentDocumentLink accountLink = new ContentDocumentLink();
        accountLink.ContentDocumentId = contentDocumentId;
        accountLink.LinkedEntityId = linkedEntityId; // Link the file to the Account record
        accountLink.ShareType = 'V'; 
        accountLink.Visibility = 'AllUsers'; // Ensures visibility in the Community files list
        insert accountLink;

        return docRecord.Id;
    }
}