public with sharing class WorkSessionControl {

    // Wrapper class to return structured data to the LWC
    public class SessionData {
        @AuraEnabled public Boolean isCheckedIn;
        @AuraEnabled public Decimal totalHours;
        @AuraEnabled public Id activeSessionId;
    }

    /**
     * @description Fetches the current user's check-in status and total hours for today.
     */
    @AuraEnabled(cacheable=true)
    public static SessionData getSessionData() {
        Id currentUserId = UserInfo.getUserId();
        Date today = Date.today();

        SessionData data = new SessionData();
        data.isCheckedIn = false;
        data.totalHours = 0;
        data.activeSessionId = null;

        List<Work_Session__c> todaySessions = [
            SELECT Id, Check_In__c, Check_Out__c, Status__c, Duration_Hours__c
            FROM Work_Session__c
            WHERE User__c = :currentUserId AND DAY_ONLY(Check_In__c) = :today
            ORDER BY CreatedDate DESC
        ];

        for (Work_Session__c session : todaySessions) {
            if (session.Status__c == 'Checked In' && session.Check_Out__c == null) {
                data.isCheckedIn = true;
                data.activeSessionId = session.Id;
            }
            if (session.Duration_Hours__c != null) {
                data.totalHours += session.Duration_Hours__c;
            }
        }
        return data;
    }

    /**
     * @description Creates a new Work Session record to check the user in.
     */
    @AuraEnabled
    public static Id checkInUser(String photoBase64, String fileType) {
        try {
            Work_Session__c newSession = new Work_Session__c(
                User__c = UserInfo.getUserId(),
                Check_In__c = System.now(),
                Status__c = 'Checked In'
            );
            insert newSession;
            attachPhoto(newSession.Id, photoBase64, fileType, 'Check-In Photo');
            return newSession.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
     * @description Updates an existing Work Session record to check the user out.
     */
    @AuraEnabled
    public static void checkOutUser(Id sessionId, String photoBase64, String fileType) {
        try {
            Work_Session__c sessionToClose = [SELECT Id FROM Work_Session__c WHERE Id = :sessionId];
            sessionToClose.Check_Out__c = System.now();
            sessionToClose.Status__c = 'Checked Out';
            update sessionToClose;
            attachPhoto(sessionId, photoBase64, fileType, 'Check-Out Photo');
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // Private helper method to handle file attachment
    private static void attachPhoto(Id parentId, String base64, String fileType, String fileName) {
        ContentVersion cv = new ContentVersion();
        cv.VersionData = EncodingUtil.base64Decode(base64);
        cv.Title = fileName + ' - ' + Datetime.now().format();
        cv.PathOnClient = fileName + '.' + (fileType.split('/')[1]);
        insert cv;

        Id docId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id].ContentDocumentId;

        ContentDocumentLink cdl = new ContentDocumentLink();
        cdl.ContentDocumentId = docId;
        cdl.LinkedEntityId = parentId;
        cdl.ShareType = 'V';
        insert cdl;
    }
}