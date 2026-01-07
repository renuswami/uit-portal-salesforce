public with sharing class AttendanceCalendarController {
    
    public class CalendarDataWrapper {
        @AuraEnabled public List<Attendance__c> attendanceList;
        @AuraEnabled public List<Holiday__c> holidayList;
        @AuraEnabled public List<Leave__c> leaveList;
    }

    @AuraEnabled(cacheable=true)
    public static CalendarDataWrapper getCalendarData(Integer month, Integer year, String employeeId) {
        CalendarDataWrapper result = new CalendarDataWrapper();
        result.attendanceList = new List<Attendance__c>();
        result.holidayList = new List<Holiday__c>();
        result.leaveList = new List<Leave__c>();
        
        try {
            Id targetUserId = null;
            Id targetAccountId = null;

            // 1. Determine Target IDs based on input
            if (String.isNotBlank(employeeId)) {
                try {
                    Id inputId = (Id)employeeId;
                    Schema.SObjectType sobjectType = inputId.getSObjectType();
                    
                    if (sobjectType == User.SObjectType) {
                        targetUserId = inputId;
                    } else if (sobjectType == Account.SObjectType) {
                        targetAccountId = inputId;
                    }
                } catch (Exception e) {
                    // Invalid ID format, ignore or log
                    System.debug('Invalid employeeId format: ' + employeeId);
                }
            } else {
                // Default to current logged-in user
                targetUserId = UserInfo.getUserId();
            }

            // 2. If we have a User ID, try to resolve the associated Person Account / Contact Account ID
            if (targetUserId != null) {
                // Query to find linked Account
                // We use LIMIT 1 and check for ContactId to handle both Portal and Internal users safely
                List<User> users = [SELECT Contact.AccountId, ContactId FROM User WHERE Id = :targetUserId LIMIT 1];
                if (!users.isEmpty()) {
                    User u = users[0];
                    if (u.ContactId != null && u.Contact != null && u.Contact.AccountId != null) {
                        targetAccountId = u.Contact.AccountId;
                    }
                }
            }

            // 3. Query Attendance
            // We match against either the User ID OR the Account ID to cover all data linkage scenarios
            // (e.g. some records might be linked to User, others to Person Account)
            result.attendanceList = [
                SELECT Id, Attendance_Date__c, Status__c, Work_Hours__c, Total_Hours_Worked__c, First_Check_In__c, Last_Check_Out__c 
                FROM Attendance__c 
                WHERE CALENDAR_MONTH(Attendance_Date__c) = :month 
                AND CALENDAR_YEAR(Attendance_Date__c) = :year 
                AND (
                    (User__c != null AND User__c = :targetUserId) 
                    OR 
                    (Employee__c != null AND Employee__c = :targetAccountId)
                )
                ORDER BY Attendance_Date__c ASC
            ];
            
            // 4. Query Holidays
            result.holidayList = [
                SELECT Id, Date__c, Name, Type__c 
                FROM Holiday__c 
                WHERE CALENDAR_MONTH(Date__c) = :month 
                AND CALENDAR_YEAR(Date__c) = :year
                ORDER BY Date__c ASC
            ];

            // 5. Query Leaves
            // Calculate Start and End of the requested month to check for overlaps
            Date firstDayOfMonth = Date.newInstance(year, month, 1);
            Date lastDayOfMonth = firstDayOfMonth.addMonths(1).addDays(-1);

            result.leaveList = [
                SELECT Id, Name, Start_Date__c, End_Date__c, Leave_Status__c, Leave_Type__c, Day_Type__c
                FROM Leave__c 
                WHERE Start_Date__c <= :lastDayOfMonth 
                AND End_Date__c >= :firstDayOfMonth
                AND (
                    (OwnerId = :targetUserId) 
                    OR 
                    (Employee__c != null AND Employee__c = :targetAccountId)
                )
                ORDER BY Start_Date__c ASC
            ];
            
        } catch (Exception e) {
            System.debug('Error in AttendanceCalendarController: ' + e.getMessage());
            throw new AuraHandledException('Unable to load calendar data: ' + e.getMessage());
        }
        
        return result;
    }
}