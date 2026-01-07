public with sharing class RegularizationTriggerHandler {
    
    public static void updateAttendanceRecords(List<Regularization__c> regList) {
        Set<Id> attendanceIds = new Set<Id>();
        
        // Collect all Attendance Ids from Regularization records
        for (Regularization__c reg : regList) {
            if (reg.AttendanceId__c != null) {
                attendanceIds.add(reg.AttendanceId__c);
            }
        }
        
        if (attendanceIds.isEmpty()) return;
        
        // Fetch related Attendance records
        Map<Id, Attendance__c> attendanceMap = new Map<Id, Attendance__c>(
            [SELECT Id, Regularized_Total_Hours__c, Regularization_Status__c, Reason_Type__c, Description__c, Check_in__c, Check_out__c
             FROM Attendance__c
             WHERE Id IN :attendanceIds]
        );
        
        List<Attendance__c> toUpdate = new List<Attendance__c>();
        
        for (Regularization__c reg : regList) {
            Attendance__c att = attendanceMap.get(reg.AttendanceId__c);
            if (att != null && reg.Approval_Status__c == 'Approved'){
                // Update fields in Attendance from Regularization
                att.Regularized_Total_Hours__c = reg.Total_Hours1__c;
                att.Regularization_Status__c = reg.Approval_Status__c;
                att.Reason_Type__c = reg.Reason_Type__c;
                att.Description__c = reg.Description__c;
                att.Check_in__c = reg.Check_in__c;
                att.Check_out__c = reg.Check_out__c;
                att.Is_Regularized__c = true;
                
                toUpdate.add(att);
            } else if (att != null && reg.Approval_Status__c == 'Rejected'){
                // Update fields in Attendance from Regularization
                att.Regularized_Total_Hours__c = reg.Total_Hours1__c;
                att.Regularization_Status__c = reg.Approval_Status__c;
                att.Reason_Type__c = reg.Reason_Type__c;
                att.Description__c = reg.Description__c;
                att.Check_in__c = reg.Check_in__c;
                att.Check_out__c = reg.Check_out__c;
                att.Is_Regularized__c = false;
                att.Reason_to_Reject__c = reg.Reason_to_Reject__c;
                toUpdate.add(att);
            }
        }
        
        if (!toUpdate.isEmpty()) {
            update toUpdate;
        }
    }
    
    public static void onInsertPendingRegularization(List<Regularization__c> newList) {
        
        Set<Id> attendanceIds = new Set<Id>();
        
        // Collect attendance ids from newly created regularization records
        for (Regularization__c reg : newList) {
            if (reg.AttendanceId__c != null && reg.Approval_Status__c == 'Pending') {
                attendanceIds.add(reg.AttendanceId__c);
            }
        }
        
        if (attendanceIds.isEmpty()) return;
        
        // Fetch Attendance records
        Map<Id, Attendance__c> attMap = new Map<Id, Attendance__c>(
            [SELECT Id, Regularized_Total_Hours__c, Regularization_Status__c,
             Reason_Type__c, Description__c, Check_in__c, Check_out__c, 
             Is_Regularized__c
             FROM Attendance__c
             WHERE Id IN :attendanceIds]
        );
        
        List<Attendance__c> toUpdate = new List<Attendance__c>();
        
        // Update attendance with pending values
        for (Regularization__c reg : newList) {
            Attendance__c att = attMap.get(reg.AttendanceId__c);
            
            if (att != null && reg.Approval_Status__c == 'Pending') {
                
                att.Regularized_Total_Hours__c = reg.Total_Hours1__c;
                att.Regularization_Status__c = 'Pending';
                att.Reason_Type__c = reg.Reason_Type__c;
                att.Description__c = reg.Description__c;
                att.Check_in__c = reg.Check_in__c;
                att.Check_out__c = reg.Check_out__c;
                att.Is_Regularized__c = false;   // Not approved yet
                
                toUpdate.add(att);
            }
        }
        
        if (!toUpdate.isEmpty()) {
            update toUpdate;
        }
    }
    
}