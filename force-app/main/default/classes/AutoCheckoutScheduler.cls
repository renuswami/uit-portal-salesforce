public class AutoCheckoutScheduler implements Schedulable {
    
    public void execute(SchedulableContext sc) {
        
        // All sessions still checked-in (forgot to checkout)
        List<Work_Session__c> sessionsToUpdate = [
            SELECT Id, Check_In__c, Check_Out__c, Status__c
            FROM Work_Session__c
            WHERE Status__c = 'Checked In'
        ];
        
        if (!sessionsToUpdate.isEmpty()) {
            for (Work_Session__c ws : sessionsToUpdate) {
                ws.Status__c = 'Checked Out';
                ws.Check_Out__c = NULL;      // or NULL: ws.Check_Out__c = null;
            }
            
            update sessionsToUpdate;
        }
    }
}