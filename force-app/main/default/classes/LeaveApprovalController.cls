public with sharing class LeaveApprovalController {
    
    @AuraEnabled(cacheable=true)
    public static List<Leave__c> getPendingLeaves() {
        try {
            return [
                SELECT Id, 
                       Name, 
                       Employee__c, 
                       Employee__r.Name, 
                       Start_Date__c, 
                       End_Date__c, 
                       Day_Type__c, 
                       Leave_Type__c, 
                       Total_Days__c, 
                       Description__c, 
                       Leave_Status__c 
                FROM Leave__c 
                WHERE Leave_Status__c = 'Pending'
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching leaves: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateLeaveStatus(List<Id> leaveIds, String status) {
        if (leaveIds == null || leaveIds.isEmpty()) {
            throw new AuraHandledException('No records selected for update.');
        }
        
        List<Leave__c> leavesToUpdate = new List<Leave__c>();
        for (Id leaveId : leaveIds) {
            leavesToUpdate.add(new Leave__c(
                Id = leaveId,
                Leave_Status__c = status
            ));
        }
        
        try {
            update leavesToUpdate;
        } catch (Exception e) {
            throw new AuraHandledException('Error updating leave status: ' + e.getMessage());
        }
    }
}