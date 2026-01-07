public with sharing class LeaveController {
    
    @AuraEnabled
    public static Map<String, Decimal> getEmployeeLeaveBalance() {
        try {
            Map<String, Decimal> balances = new Map<String, Decimal>();
            
            // Get current user with contact and account info
            User currentUser = [
                SELECT Id, ContactId, Contact.AccountId 
                FROM User 
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];
            
            System.debug('Current User: ' + currentUser);
            
            if (currentUser.ContactId == null || currentUser.Contact.AccountId == null) {
                throw new AuraHandledException('User is not associated with a Contact or Account.');
            }
            
            // Get employee account with leave balances
            Account emp = [
                SELECT Id, Name, Casual_Leave_Balance__c, Sick_Leave_Balance__c
                FROM Account 
                WHERE Id = :currentUser.Contact.AccountId 
                LIMIT 1
            ];
            
            System.debug('Employee Account: ' + emp);
            
            // Populate balances with safe defaults
            balances.put('Sick Leave', emp.Sick_Leave_Balance__c != null ? emp.Sick_Leave_Balance__c : 0);
            balances.put('Casual Leave', emp.Casual_Leave_Balance__c != null ? emp.Casual_Leave_Balance__c : 0);
            
            System.debug('Final Balances: ' + balances);
            
            return balances;
            
        } catch (Exception e) {
            System.debug('Error in getEmployeeLeaveBalance: ' + e.getMessage() + ' at ' + e.getLineNumber());
            throw new AuraHandledException('Error loading leave balances: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static String applyForLeave(String leaveType, Decimal requiredDays, 
                                       Date startDate, Date endDate, String dayType, 
                                       String halfDayType, String description) {
        try {
            System.debug('applyForLeave called with: ' + leaveType + ', ' + requiredDays);
            
            // Get current user
            User currentUser = [
                SELECT Id, ContactId, Contact.AccountId 
                FROM User 
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];
            
            if (currentUser.ContactId == null || currentUser.Contact.AccountId == null) {
                throw new AuraHandledException('User is not associated with a Contact or Account.');
            }
            
            Id accountId = currentUser.Contact.AccountId;
            
            // Get employee current balance WITH FOR UPDATE to lock record
            Account emp = [
                SELECT Id, Casual_Leave_Balance__c, Sick_Leave_Balance__c,
                       Total_Casual_Leave_Taken__c, Total_Sick_Leave_Taken__c
                FROM Account 
                WHERE Id = :accountId 
                LIMIT 1
                FOR UPDATE
            ];
            
            System.debug('Current Employee: ' + emp);
            System.debug('Leave Type: ' + leaveType + ', Required Days: ' + requiredDays);
            
            Decimal currentBalance;
            Decimal currentTaken;
            
            // Check balance based on leave type
            if (leaveType == 'Sick Leave') {
                currentBalance = emp.Sick_Leave_Balance__c != null ? emp.Sick_Leave_Balance__c : 0;
                currentTaken = emp.Total_Sick_Leave_Taken__c != null ? emp.Total_Sick_Leave_Taken__c : 0;
            } else if (leaveType == 'Casual Leave') {
                currentBalance = emp.Casual_Leave_Balance__c != null ? emp.Casual_Leave_Balance__c : 0;
                currentTaken = emp.Total_Casual_Leave_Taken__c != null ? emp.Total_Casual_Leave_Taken__c : 0;
            } 
            else if (leaveType == 'Unpaid Leave') {
    // 🚀 NO BALANCE CHECK FOR UNPAID LEAVE
    currentBalance = null;
    currentTaken = null;

} 
            else {
                throw new AuraHandledException('Invalid leave type: ' + leaveType);
            }
            
            System.debug('Current Balance: ' + currentBalance + ', Required: ' + requiredDays);
            
            // Check if sufficient balance available
          /*  if (currentBalance < requiredDays) {
                throw new AuraHandledException('Insufficient leave balance. Available: ' + currentBalance + ', Required: ' + requiredDays);
            } */

            // Skip balance validation for Unpaid Leave
if (leaveType != 'Unpaid Leave') {
    if (currentBalance < requiredDays) {
        throw new AuraHandledException(
            'Insufficient leave balance. Available: ' + currentBalance + ', Required: ' + requiredDays
        );
    }
}

            
            // Update balance and taken leaves
            if (leaveType == 'Sick Leave') {
                emp.Sick_Leave_Balance__c = currentBalance - requiredDays;
                emp.Total_Sick_Leave_Taken__c = (currentTaken != null ? currentTaken : 0) + requiredDays;
            } else if (leaveType == 'Casual Leave') {
                emp.Casual_Leave_Balance__c = currentBalance - requiredDays;
                emp.Total_Casual_Leave_Taken__c = (currentTaken != null ? currentTaken : 0) + requiredDays;
            }
            
            // Update account
            update emp;
            System.debug('Account updated successfully');
            
            // Create leave record
            Leave__c leaveRecord = new Leave__c();
            leaveRecord.Employee__c = emp.Id;
            leaveRecord.Start_Date__c = startDate;
            leaveRecord.End_Date__c = endDate;
            leaveRecord.Leave_Type__c = leaveType;
            leaveRecord.Day_Type__c = dayType;
            leaveRecord.Description__c = description;
            leaveRecord.Leave_Status__c = 'Pending';
            insert leaveRecord;
            System.debug('Leave record created: ' + leaveRecord.Id);
            
            return 'Success: Leave applied successfully. Balance updated.';
            
        } catch (Exception e) {
            System.debug('Error in applyForLeave: ' + e.getMessage() + ' at line ' + e.getLineNumber());
            throw new AuraHandledException('Error applying leave: ' + e.getMessage());
        }
    }
}