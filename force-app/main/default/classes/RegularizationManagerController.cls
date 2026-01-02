public with sharing class RegularizationManagerController {
    
    @AuraEnabled(cacheable=true)
    public static List<Regularization__c> getAllRegularizations() {
        try {
            return [
                select Id, Name,Check_in__c, 
                Check_out__c, 
                Reason_Type__c,
                Status__c, Approval_Status__c, 
                Log_Hours__c,
                Total_Hours1__c, 
                CreatedDate , 
                CreatedById,
                CreatedBy.Name,  
                Reason_to_Reject__c,
                AttendanceId__r.First_Check_In__c, 
                AttendanceId__r.Last_Check_Out__c,
                AttendanceId__r.Work_Hours__c
                FROM Regularization__c 
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching regularizations: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Regularization__c> getRegularizationsByEmployee(String employeeId) {
        try {
            return [
                select Id,
                Name,Check_in__c, 
                Check_out__c,
                Reason_Type__c, 
                Status__c, 
                Approval_Status__c,
                Log_Hours__c, 
                Total_Hours1__c,
                CreatedDate ,
                CreatedById, 
                CreatedBy.Name,  
                Reason_to_Reject__c,
                AttendanceId__r.First_Check_In__c,
                AttendanceId__r.Last_Check_Out__c,
 				AttendanceId__r.Total_Hours_Worked__c
                FROM Regularization__c
                WHERE CreatedById = :employeeId 
                ORDER BY CreatedDate DESC
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching regularizations: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static List<User> getEmployees() {
        try {
            return [
                SELECT Id, Name, Email, Department, Title,
                Contact.Account.Id, Contact.Account.IsPersonAccount
                FROM User
                WHERE IsActive = true
                AND Contact.Account.IsPersonAccount = true
                ORDER BY Name
                LIMIT 1000
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching employees: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static void updateRegularizationStatus(String recordId, String newStatus, String rejectReason) {
        System.debug('recordId: ' + recordId);
        System.debug('newStatus: ' + newStatus);
        System.debug('rejectReason: ' + rejectReason);
        try {
            Regularization__c reg = new Regularization__c(
                Id = recordId,
                Approval_Status__c = newStatus,
                Reason_to_Reject__c = rejectReason
            );
            
            update reg;
        } catch (Exception e) {
            throw new AuraHandledException('Error updating status: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Time_Log__c> getTimeLogsByAttendance(String recordId) {
        try {
            
            Regularization__c reg = [
                SELECT AttendanceId__c
                FROM Regularization__c
                WHERE Id = :recordId
                LIMIT 1
            ];
            
            return [
                SELECT Id, Hours__c, Non_Billable__c, Description__c, CreatedBy.Name, Date__c, Task__r.Name FROM Time_Log__c
                WHERE Attendance__c = :reg.AttendanceId__c
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching time logs: ' + e.getMessage());
        }
    }
}