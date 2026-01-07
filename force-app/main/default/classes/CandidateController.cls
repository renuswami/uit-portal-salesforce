public without sharing class CandidateController {

    // Method to create the new Candidate record
    @AuraEnabled
    public static Id submitApplication(
        String firstName, String lastName, String email, String phone, String positionValue,
        String street, String city, String state, String postalCode, String country,
        Boolean CAddressEqualsPAddress,
        String permanentStreet, String permanentCity, String permanentState, String permanentPostalCode, 
        String permanentCountry,
        String highestDegree, String universityName, Decimal graduationYear,
        Boolean hasPriorExperience, String yearsOfExperience, String lastCompany, 
        
        String jobProfile, Decimal currentCTC, Decimal expectedCTC, String noticePeriodDays,
        String resumeBase64, String resumeFileName, String payslipBase64, String payslipFileName
    ) {
        Candidate__c newCandidate = new Candidate__c(
            First_Name__c = firstName,
            Last_Name__c = lastName,
            Email__c = email,
            Phone__c = phone,
            Position__c = positionValue,
            Source__c = 'Public Portal', // Set the Source field [cite: 77]
            Current_Address__Street__s = street,
            Current_Address__City__s = city,
            Current_Address__StateCode__s = state,
            Current_Address__PostalCode__s = postalCode,
            Current_Address__CountryCode__s = country,
            Current_Address_equals_Permanent_Address__c	= CAddressEqualsPAddress,
            Permanent_Address__Street__s = permanentStreet,
            Permanent_Address__City__s = permanentCity,
            Permanent_Address__StateCode__s= permanentState,
            Permanent_Address__PostalCode__s = permanentPostalCode,
            Permanent_Address__CountryCode__s = permanentCountry,
            Highest_Degree__c = highestDegree,
            University_College_Name__c = universityName,
            Graduation_Year__c = graduationYear, //String to decimal error
            Has_Prior_Experience__c = hasPriorExperience,
            Years_of_Experience__c = yearsOfExperience,
            Last_Company__c = lastCompany,
            Job_Profile__c = jobProfile,
            Current_CTC__c = currentCTC,
            Expected_CTC__c = expectedCTC,
            Notice_Period__c = noticePeriodDays
        );

        Date cutoffDate = System.today().addMonths(-3);
        List<Candidate__c> existingCandidates = [SELECT Id, CreatedDate FROM Candidate__c WHERE Email__c = :email
												AND Phone__c = :phone AND Position__c = :positionValue 
                                               	ORDER BY CreatedDate DESC LIMIT 1 ];
        if (!existingCandidates.isEmpty()) {
            Candidate__c lastApplication = existingCandidates[0];
            if (lastApplication.CreatedDate.date() > cutoffDate) {
                throw new AuraHandledException('We already have your application for this position on file, and you may only re-apply after 3 months from your last submission.');
            }
            
        }
        
        if (CAddressEqualsPAddress==true){
            newCandidate.Permanent_Address__Street__s = newCandidate.Current_Address__Street__s;
            newCandidate.Permanent_Address__City__s = newCandidate.Current_Address__City__s;
            newCandidate.Permanent_Address__StateCode__s = newCandidate.Current_Address__StateCode__s;
            newCandidate.Permanent_Address__PostalCode__s = newCandidate.Current_Address__PostalCode__s;
            newCandidate.Permanent_Address__CountryCode__s = newCandidate.Current_Address__CountryCode__s;
        }

        insert newCandidate;
        system.debug('Insertion Complete:'+ newCandidate.Id);
        
        if (resumeBase64 != null && resumeFileName != null) {
            saveDocument(newCandidate.Id, resumeBase64, resumeFileName);
        }
    
        if (payslipBase64 != null && payslipFileName != null) {
            saveDocument(newCandidate.Id, payslipBase64, payslipFileName);
        }
            
        return newCandidate.Id;
    }
    
    public static void saveDocument(Id linkedEntityId, String fileBase64, String fileName) {
        try{
            Blob fileBlob = EncodingUtil.base64Decode(fileBase64);

            ContentVersion cv = new ContentVersion(
                Title = fileName,
                PathOnClient = '/' + fileName,
                VersionData = fileBlob,
                Origin = 'C' 
            );
            insert cv;
    
            Id contentDocumentId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id].ContentDocumentId;
    
            ContentDocumentLink cdl = new ContentDocumentLink(
                ContentDocumentId = contentDocumentId,
                LinkedEntityId = linkedEntityId,
                ShareType = 'V',
                Visibility = 'AllUsers' 
            );
            insert cdl;
       	}catch(DmlException e) {
                // Forces the specific DML error message to the LWC front-end
                throw new AuraHandledException('File DML Error (' + fileName + '): ' + e.getMessage());
            } catch (Exception e) {
                throw new AuraHandledException('Generic File Error (' + fileName + '): ' + e.getMessage());
            }
        
    }
}