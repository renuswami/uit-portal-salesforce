public with sharing class RegularizationController {
    
    @AuraEnabled(cacheable=true)
    public static Attendance__c getAttendanceRecord(Date selectedDate, Id recordId) {
        try {
            if (selectedDate == null) {
                throw new AuraHandledException('Please select a valid date.');
            }
            // Safely load user's AccountId, handle missing Contact/Account to avoid null dereference
            User u = [
                SELECT Contact.AccountId, ContactId
                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];
            if (u.ContactId == null || u.Contact == null || u.Contact.AccountId == null) {
                return null;
            }
            Id userAccountId = u.Contact.AccountId;
            
            // Query attendance safely; return first or null to avoid List index out of bounds
            List<Attendance__c> attList = [
                SELECT Id, Name, Employee__c, First_Check_In__c, Last_Check_Out__c,
                       Total_Hours_Worked__c, Status__c, Description__c, Attendance_Date__c
                FROM Attendance__c
                WHERE Employee__c = :userAccountId
                  AND Attendance_Date__c = :selectedDate
                ORDER BY CreatedDate DESC
                LIMIT 1
            ];
            
            if (attList.isEmpty()) {
                return null;
            }
            return attList[0];
        }
        catch (AuraHandledException ahe) {
            throw ahe; // rethrow handled exceptions
        }
        catch (Exception e) {
            throw new AuraHandledException('Server Error: ' + e.getMessage());
        }
    }
    
   /* @AuraEnabled
    public static Boolean getTimeLogExists(Date selectedDate) {
        try {
            // Get current user's ContactId
            User currentUser = [
                SELECT ContactId
                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];
            
            if (currentUser.ContactId == null) {
                return false;
            }
            
            // Check if Time Log exists for the selected date
            List<Time_Log__c> timeLogs = [
                SELECT Id
                FROM Time_Log__c
                WHERE CreatedBy.ContactId = :currentUser.ContactId
                AND Date__c = :selectedDate
                LIMIT 1
            ];
            
            return !timeLogs.isEmpty();
        } catch (Exception e) {
            return false; // Default to false on error to prevent accidental submission
        }
    } */

    @AuraEnabled
    public static Decimal getTotalLoggedHours(Date selectedDate) {

        User currentUser = [
            SELECT ContactId
            FROM User
            WHERE Id = :UserInfo.getUserId()
            LIMIT 1
        ];

       if (currentUser.ContactId == null) {
            return 0;
        }

        AggregateResult[] ar = [
            SELECT
                SUM(Hours__c) billable,
                SUM(Non_Billable__c) nonBillable
            FROM Time_Log__c
            WHERE CreatedBy.ContactId = :currentUser.ContactId
            AND Date__c = :selectedDate
        ];

        Decimal billable = (Decimal) ar[0].get('billable');
        Decimal nonBillable = (Decimal) ar[0].get('nonBillable');

        return (billable == null ? 0 : billable)
             + (nonBillable == null ? 0 : nonBillable);
}

    
    @AuraEnabled
    public static void updateAttendanceRecord(
        Id attendanceId,
        Datetime checkIn,
        Datetime checkOut,
        Decimal totalTime,
        String reason,
        String description,
        Date selectedDate
    ) {  
        try {
            // Step 1: Get current user's Account info
            User currentUser = [
                SELECT Contact.AccountId, Contact.Account.Name, ContactId
                FROM User
                WHERE Id = :UserInfo.getUserId()
                LIMIT 1
            ];
            
            Id userAccountId;
            String userAccountName;
            
            if (currentUser.Contact != null && currentUser.Contact.Account != null) {
                userAccountId = currentUser.Contact.AccountId;
                userAccountName = currentUser.Contact.Account.Name;
            } else {
                throw new AuraHandledException('User is not linked to an Account or Contact.');
            }
            
            System.debug('updateAttendanceRecord userAccountId: ' + userAccountId);
            
            // Step 2: Get Attendance record (if exists)
            List<Attendance__c> attList = [
                SELECT Id, Name, Employee__c, Attendance_Date__c, CreatedBy.Name 
                FROM Attendance__c
                WHERE Employee__c = :userAccountId
                AND Attendance_Date__c = :selectedDate
                LIMIT 1
            ];
            
            Attendance__c attendanceRecord;
            
            if (attList.isEmpty()) {
                // ✅ No existing record, so create a new one
                attendanceRecord = new Attendance__c(
                    Employee__c = userAccountId,
                    Attendance_Date__c = selectedDate,
                    Description__c = 'Auto-created via Regularization'
                );
                
                insert attendanceRecord;
                System.debug('🟢 New Attendance__c record created: ' + attendanceRecord.Id);
            } else {
                attendanceRecord = attList[0];
                System.debug('ℹ️ Existing Attendance record found: ' + attendanceRecord.Id);
            }
            
            // Step 3: Continue with Regularization creation/update
            // Note: Time log validation removed from here as it's now handled in LWC
            List<Regularization__c> existingRegs = [
                SELECT Id
                FROM Regularization__c
                WHERE AttendanceId__c = :attendanceRecord.Id
                AND DAY_ONLY(CreatedDate) = :Date.today()
                LIMIT 1
            ];
            
            if (!existingRegs.isEmpty()) {
                Regularization__c existingReg = existingRegs[0];
                System.debug('🟡 Updating existing Regularization: ' + existingReg.Id);
                
                existingReg.Check_in__c = checkIn;
                existingReg.Check_out__c = checkOut;
                existingReg.Total_Hours__c = totalTime;
                existingReg.Reason_Type__c = reason;
                existingReg.Description__c = description;
                existingReg.Approval_Status__c = 'Pending';
                
                update existingReg;
                System.debug('✅ Regularization updated: ' + existingReg.Id);
            } else {
                Regularization__c regRecord = new Regularization__c(
                    AttendanceId__c = attendanceRecord.Id,
                    Check_in__c = checkIn,
                    Check_out__c = checkOut,
                    Total_Hours__c = totalTime,
                    Reason_Type__c = reason,
                    Description__c = description,
                    Approval_Status__c = 'Pending'
                );
                
                insert regRecord;
                System.debug('✅ Regularization created: ' + regRecord.Id);
            }
            
        } catch (AuraHandledException ahe) {
            throw ahe;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating/updating Regularization record: ' + e.getMessage());
        }
    }
}