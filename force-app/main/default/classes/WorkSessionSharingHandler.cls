public with sharing class WorkSessionSharingHandler {
    
    /**
     * Handle sharing for Work Session records
     * Ensures that users can only access their own work session records
     */
    public static void handleSharing(List<Work_Session__c> workSessions) {
        
        List<Work_Session__Share> sharesToInsert = new List<Work_Session__Share>();
        List<Work_Session__Share> sharesToDelete = new List<Work_Session__Share>();
        
        // Get existing shares for these records
        Set<Id> workSessionIds = new Set<Id>();
        for (Work_Session__c ws : workSessions) {
            workSessionIds.add(ws.Id);
        }
        
        Map<Id, List<Work_Session__Share>> existingSharesMap = new Map<Id, List<Work_Session__Share>>();
        for (Work_Session__Share share : [
            SELECT Id, ParentId, UserOrGroupId, AccessLevel, RowCause 
            FROM Work_Session__Share 
            WHERE ParentId IN :workSessionIds 
            AND RowCause = :Schema.Work_Session__Share.RowCause.Manual
        ]) {
            if (!existingSharesMap.containsKey(share.ParentId)) {
                existingSharesMap.put(share.ParentId, new List<Work_Session__Share>());
            }
            existingSharesMap.get(share.ParentId).add(share);
        }
        
        for (Work_Session__c workSession : workSessions) {
            // Remove existing manual shares for this record
            if (existingSharesMap.containsKey(workSession.Id)) {
                sharesToDelete.addAll(existingSharesMap.get(workSession.Id));
            }
            
            // Create new share for the user associated with this work session
            if (workSession.User__c != null && workSession.User__c != workSession.OwnerId) {
                Work_Session__Share newShare = new Work_Session__Share();
                newShare.ParentId = workSession.Id;
                newShare.UserOrGroupId = workSession.User__c;
                newShare.AccessLevel = 'Edit';
                newShare.RowCause = Schema.Work_Session__Share.RowCause.Manual;
                sharesToInsert.add(newShare);
            }
        }
        
        // Delete old shares
        if (!sharesToDelete.isEmpty()) {
            try {
                delete sharesToDelete;
            } catch (DmlException e) {
                System.debug('Error deleting work session shares: ' + e.getMessage());
            }
        }
        
        // Insert new shares
        if (!sharesToInsert.isEmpty()) {
            try {
                insert sharesToInsert;
            } catch (DmlException e) {
                System.debug('Error inserting work session shares: ' + e.getMessage());
            }
        }
    }
}