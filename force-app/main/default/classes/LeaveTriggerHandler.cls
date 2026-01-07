public class LeaveTriggerHandler {

    public static void handleStatusChange(Map<Id, Leave__c> oldMap, Map<Id, Leave__c> newMap) {

        Set<Id> accountIds = new Set<Id>();

        // collect only accounts related to rejected updates
        for (Leave__c newRec : newMap.values()) {
            Leave__c oldRec = oldMap.get(newRec.Id);

            if (oldRec.Leave_Status__c != newRec.Leave_Status__c &&
                newRec.Leave_Status__c == 'Rejected' &&
                newRec.Employee__c != null) {

                accountIds.add(newRec.Employee__c);
            }
        }

        if (accountIds.isEmpty()) return;

        // Query all leave-related fields
        Map<Id, Account> accMap = new Map<Id, Account>(
            [
                SELECT Id,
                       Sick_Leave_Balance__c,
                       Casual_Leave_Balance__c,
                       Total_Sick_Leave_Taken__c,
                       Total_Casual_Leave_Taken__c
                FROM Account
                WHERE Id IN :accountIds
            ]
        );

        List<Account> accountsToUpdate = new List<Account>();

        for (Leave__c newRec : newMap.values()) {
            Leave__c oldRec = oldMap.get(newRec.Id);

            if (oldRec.Leave_Status__c != newRec.Leave_Status__c &&
                newRec.Leave_Status__c == 'Rejected') {

                Account emp = accMap.get(newRec.Employee__c);
                if (emp == null) continue;

                Decimal daysToReturn = newRec.Total_Days__c == null ? 0 : newRec.Total_Days__c;

                // Return balance & reduce taken counts
                if (newRec.Leave_Type__c == 'Sick Leave') {

                    // Reverse balance
                    emp.Sick_Leave_Balance__c =
                        (emp.Sick_Leave_Balance__c == null ? 0 : emp.Sick_Leave_Balance__c) + daysToReturn;

                    // Reverse taken count
                    emp.Total_Sick_Leave_Taken__c =
                        (emp.Total_Sick_Leave_Taken__c == null ? 0 : emp.Total_Sick_Leave_Taken__c) - daysToReturn;
                }
                else if (newRec.Leave_Type__c == 'Casual Leave') {

                    emp.Casual_Leave_Balance__c =
                        (emp.Casual_Leave_Balance__c == null ? 0 : emp.Casual_Leave_Balance__c) + daysToReturn;

                    emp.Total_Casual_Leave_Taken__c =
                        (emp.Total_Casual_Leave_Taken__c == null ? 0 : emp.Total_Casual_Leave_Taken__c) - daysToReturn;
                }

                accountsToUpdate.add(emp);
            }
        }

        if (!accountsToUpdate.isEmpty()) {
            update accountsToUpdate;
        }
    }
}