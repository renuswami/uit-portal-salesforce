global class DailyAttendanceScheduler implements Schedulable {

    global void execute(SchedulableContext sc) {
        createDailyAttendanceRecords();
    }

    @future
    public static void createDailyAttendanceRecords() {
        Date today = Date.today();

        // Step 1: Get all employees (all Accounts)
        List<Account> employees = [SELECT Id, Name FROM Account];

        if (employees.isEmpty()) {
            System.debug('No employees found.');
            return;
        }

        // Step 2: Get all Attendance records for today
        Set<Id> existingEmployeeIds = new Set<Id>();
        for (Attendance__c att : [
            SELECT Employee__c 
            FROM Attendance__c 
            WHERE Attendance_Date__c = :today
        ]) {
            existingEmployeeIds.add(att.Employee__c);
        }

        // Step 3: Prepare new Attendance records for employees without one
        List<Attendance__c> newAttendances = new List<Attendance__c>();
        for (Account emp : employees) {
            if (!existingEmployeeIds.contains(emp.Id)) {
                newAttendances.add(new Attendance__c(
                    Employee__c = emp.Id,
                    Attendance_Date__c = today
                ));
            }
        }

        // Step 4: Insert all new Attendance records
        if (!newAttendances.isEmpty()) {
            try {
                insert newAttendances;
                System.debug('Created ' + newAttendances.size() + ' Attendance records for today.');
            } catch (Exception e) {
                System.debug('Error inserting Attendance records: ' + e.getMessage());
            }
        } else {
            System.debug('All employees already have Attendance records for today.');
        }
    }
}