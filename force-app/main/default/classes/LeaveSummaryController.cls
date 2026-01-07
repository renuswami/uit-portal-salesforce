public with sharing class LeaveSummaryController {
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getLeaveSummary() {
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            // Get current user with contact info - enhanced for communities
            User currentUser = [
                SELECT Id, ContactId, Contact.AccountId, Contact.Account.Name
                FROM User 
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];
            
            System.debug('Current User: ' + JSON.serialize(currentUser));
            
            Id userAccountId;
            
            // Check if user has a contact and account
            if (currentUser.ContactId == null) {
                throw new AuraHandledException('No Contact found for current user. Please ensure this user has a linked Contact.');
            }
            
            if (currentUser.Contact.AccountId == null) {
                throw new AuraHandledException('No Account found for the current user\'s Contact.');
            }
            
            userAccountId = currentUser.Contact.AccountId;
            System.debug('User Account ID: ' + userAccountId);
            
            // Get leave balances from Account with error handling
            List<Account> accounts = [
                SELECT Id, Name, Casual_Leave_Balance__c, Sick_Leave_Balance__c, 
                Total_Casual_Leave_Taken__c, Total_Sick_Leave_Taken__c 
                FROM Account 
                WHERE Id = :userAccountId 
                LIMIT 1
            ];
            
            if (accounts.isEmpty()) {
                throw new AuraHandledException('Account not found with ID: ' + userAccountId);
            }
            
            Account balance = accounts[0];
            System.debug('Account Data: ' + JSON.serialize(balance));
            
            // Prepare leave data for component
            result.put('casualLeave', new Map<String, Object>{
                'available' => balance.Casual_Leave_Balance__c != null ? balance.Casual_Leave_Balance__c : 0,
                    'booked' => balance.Total_Casual_Leave_Taken__c != null ? balance.Total_Casual_Leave_Taken__c : 0
                        });
            
            result.put('sickLeave', new Map<String, Object>{
                'available' => balance.Sick_Leave_Balance__c != null ? balance.Sick_Leave_Balance__c : 0,
                    'booked' => balance.Total_Sick_Leave_Taken__c != null ? balance.Total_Sick_Leave_Taken__c : 0
                        });
            
            // Saturday Leave - you might need to add these fields to Account
            result.put('saturdayLeave', new Map<String, Object>{
                'available' => 2,
                    'booked' => 0
                    });
            
            // Calculate total leaves booked this year
            Decimal totalLeavesBooked = (balance.Total_Casual_Leave_Taken__c != null ? balance.Total_Casual_Leave_Taken__c : 0) +
                (balance.Total_Sick_Leave_Taken__c != null ? balance.Total_Sick_Leave_Taken__c : 0);
            
            result.put('totalLeavesBooked', totalLeavesBooked);
            result.put('totalAbsent', 0);
            
        } catch (Exception e) {
            System.debug('Error in getLeaveSummary: ' + e.getMessage() + ' Stack: ' + e.getStackTraceString());
            throw new AuraHandledException('Error fetching leave summary: ' + e.getMessage());
        }
        
        return result;
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getUpcomingHolidays() {
        List<Map<String, String>> holidays = new List<Map<String, String>>();
        Date today = System.today();
        
        try {
            System.debug('Today date: ' + today);
            
            // Query with exact field names from your export
            List<Holiday__c> upcomingHolidays = [
                SELECT Id, Name, Date__c, Type__c, Active__c
                FROM Holiday__c 
                WHERE Date__c >= :today
                AND Active__c = true
                ORDER BY Date__c ASC
            ];
            
            System.debug('Query executed. Found ' + upcomingHolidays.size() + ' records');
            System.debug('Records: ' + JSON.serializePretty(upcomingHolidays));
            
            for(Holiday__c holiday : upcomingHolidays) {
                System.debug('Processing holiday: ' + holiday.Name + ' | Date: ' + holiday.Date__c);
                
                Map<String, String> holidayMap = new Map<String, String>();
                
                // Format date display
                String dateStr = DateTime.newInstance(
                    holiday.Date__c, 
                    Time.newInstance(0, 0, 0, 0)
                ).format('dd-MMM-yyyy, EEEE');
                
                holidayMap.put('id', holiday.Id);
                holidayMap.put('date', dateStr);
                holidayMap.put('name', holiday.Name);
                holidayMap.put('type', holiday.Type__c != null ? holiday.Type__c : 'General');
                
                holidays.add(holidayMap);
            }
            
            System.debug('Final holidays list size: ' + holidays.size());
            
        } catch (Exception e) {
            System.debug('Error in getUpcomingHolidays: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Holiday Error: ' + e.getMessage());
        }
        
        return holidays;
    }
}