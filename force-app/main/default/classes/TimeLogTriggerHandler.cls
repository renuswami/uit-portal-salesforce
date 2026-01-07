public class TimeLogTriggerHandler {
    
    public static void setAttendanceOnTimeLogs(
        List<Time_Log__c> newList,
        Map<Id, Time_Log__c> oldMap
    ) {

        // 1️⃣ Collect dates from Time Logs
        Set<Date> datesToCheck = new Set<Date>();
        for (Time_Log__c log : newList) {
            if (log.Date__c != null) {
                datesToCheck.add(log.Date__c);
            }
        }
        if (datesToCheck.isEmpty()) return;

        // 2️⃣ Get current user's Account (Employee)
        Id userAccountId = [
            SELECT Contact.AccountId
            FROM User
            WHERE Id = :UserInfo.getUserId()
        ].Contact.AccountId;

        // 3️⃣ Query existing Attendances
        Map<Date, Attendance__c> attendanceMap = new Map<Date, Attendance__c>();
        for (Attendance__c att : [
            SELECT Id, Attendance_Date__c
            FROM Attendance__c
            WHERE Employee__c = :userAccountId
            AND Attendance_Date__c IN :datesToCheck
        ]) {
            attendanceMap.put(att.Attendance_Date__c, att);
        }

        // 4️⃣ Find missing dates & create Attendance
        List<Attendance__c> attendancesToInsert = new List<Attendance__c>();

        for (Date d : datesToCheck) {
            if (!attendanceMap.containsKey(d)) {
                Attendance__c newAtt = new Attendance__c(
                    Employee__c = userAccountId,
                    Attendance_Date__c = d
                );
                attendancesToInsert.add(newAtt);
            }
        }

        if (!attendancesToInsert.isEmpty()) {
            insert attendancesToInsert;

            // Add newly created records to map
            for (Attendance__c att : attendancesToInsert) {
                attendanceMap.put(att.Attendance_Date__c, att);
            }
        }

        // 5hh️⃣ Assign Attendance to Time Logs
        for (Time_Log__c log : newList) {

            Date oldDate = (oldMap != null && oldMap.containsKey(log.Id))
                ? oldMap.get(log.Id).Date__c
                : null;

            // If Date cleared → clear Attendance
            if (log.Date__c == null) {
                log.Attendance__c = null;
                continue;
            }

            // If date unchanged → skip
            if (log.Id != null && log.Date__c == oldDate) {
                continue;
            }

            // Assign Attendance
            if (attendanceMap.containsKey(log.Date__c)) {
                log.Attendance__c = attendanceMap.get(log.Date__c).Id;
            }
        }
    }
}