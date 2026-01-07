global class MonthlyLeaveAccrual implements Database.Batchable<SObject>, Schedulable {

    global void execute(SchedulableContext sc) {
        Database.executeBatch(this, 200);
    }

    global Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(
            'SELECT Id, Casual_Leave_Balance__c, Sick_Leave_Balance__c, Last_Accrual_Date__c FROM Account where IsPersonAccount = true'
        );
    }

    global void execute(Database.BatchableContext bc, List<Account> scope) {

        List<Account> employeesToUpdate = new List<Account>();

       for(Account emp : scope) {

            Decimal currentCasual = emp.Casual_Leave_Balance__c != null ? emp.Casual_Leave_Balance__c : 0;
            Decimal currentSick = emp.Sick_Leave_Balance__c != null ? emp.Sick_Leave_Balance__c : 0;

         //   if(emp.Last_Accrual_Date__c == null || 
           //    emp.Last_Accrual_Date__c.month() != Date.today().month()) {

                emp.Casual_Leave_Balance__c = currentCasual + 0.5;
                emp.Sick_Leave_Balance__c = currentSick + 1.0;
            //    emp.Last_Accrual_Date__c = Date.today();

                employeesToUpdate.add(emp);
           // }
        } 

        if(!employeesToUpdate.isEmpty()) {
            update employeesToUpdate;
        } 
    }

    global void finish(Database.BatchableContext bc) {
        System.debug('Monthly Leave Accrual Completed');
    }
}