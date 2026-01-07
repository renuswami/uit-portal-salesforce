public with sharing class AttendanceTimelineController {

    // 1. This "wrapper" class holds one day's data and its list of sessions
    public class DailyAttendanceWrapper {
        @AuraEnabled public Id attendanceId { get; set; }
        @AuraEnabled public Date attendanceDate { get; set; }
        @AuraEnabled public String dayLabel { get; set; } // e.g., "27"
        @AuraEnabled public String dayOfWeek { get; set; } // e.g., "Mon"
        @AuraEnabled public Decimal totalHours { get; set; }
        @AuraEnabled public String status { get; set; } // e.g., "Present", "Absent"
        
        @AuraEnabled public List<Work_Session__c> sessions { get; set; }

        public DailyAttendanceWrapper(Attendance__c att) {
            this.attendanceId = att.Id;
            this.attendanceDate = att.Attendance_Date__c;
            this.totalHours = att.Total_Hours_Worked__c;
            this.status = att.Status__c;
            this.sessions = new List<Work_Session__c>(); 

            // Convert the Date to a Datetime to use the format(String) method
            Datetime dt = Datetime.newInstance(att.Attendance_Date__c, Time.newInstance(0, 0, 0, 0));

            // Now these lines will work
            this.dayOfWeek = dt.format('EEE');
            this.dayLabel = dt.format('dd');
        }
    }

    // 2. This is the main method your LWC will call
    @AuraEnabled(cacheable=true)
    public static List<DailyAttendanceWrapper> getAttendanceData(Date startDate, Date endDate) {
        
        // Get the AccountId for the portal user
        Id userAccountId;
        try {
            userAccountId = [SELECT Contact.AccountId FROM User WHERE Id = :UserInfo.getUserId()].Contact.AccountId;
        } catch (Exception e) {
            throw new AuraHandledException('User is not linked to an employee Account.');
        }

        // Create a map to hold wrappers, keyed by the parent Attendance ID
        Map<Id, DailyAttendanceWrapper> summaryMap = new Map<Id, DailyAttendanceWrapper>();

        // 3. Get all the parent Attendance records for the period
        List<Attendance__c> parentDays = [
            SELECT Id, Attendance_Date__c, Total_Hours_Worked__c, Status__c 
            FROM Attendance__c 
            WHERE Employee__c = :userAccountId
            AND Attendance_Date__c >= :startDate 
            AND Attendance_Date__c <= :endDate
            ORDER BY Attendance_Date__c
        ];

        // 4. Populate the map with parent records
        for(Attendance__c att : parentDays) {
            summaryMap.put(att.Id, new DailyAttendanceWrapper(att));
        }

        // 5. Get all CHILD Work Sessions for those parent days in ONE query
        List<Work_Session__c> childSessions = [
            SELECT Id, Attendance__c, Check_In__c, Check_Out__c, Duration_Hours__c
            FROM Work_Session__c
            WHERE Attendance__c IN :summaryMap.keySet()
            ORDER BY Check_In__c
        ];

        // 6. Distribute the child sessions into their parent wrappers
        for(Work_Session__c session : childSessions) {
            if(summaryMap.containsKey(session.Attendance__c)) {
                summaryMap.get(session.Attendance__c).sessions.add(session);
            }
        }

        // 7. Return the list of wrappers, which now contain their children
        return summaryMap.values();
    }
}