public with sharing class AttendanceAndRegularizeController {

    // DTO to return counts to LWC
    public class RegCountsDTO {
        @AuraEnabled public Integer totalApplied;
        @AuraEnabled public Integer approved;
        @AuraEnabled public Integer pending;
        @AuraEnabled public Integer rejected;
    }

    public class AttendanceResult {
        @AuraEnabled public Integer present;
        @AuraEnabled public Integer absent;
        @AuraEnabled public Integer halfDayPresent;
        @AuraEnabled public Integer halfDayAbsent;

        public AttendanceResult(Integer p, Integer a, Integer hdp, Integer hda) {
            present = p;
            absent = a;
            halfDayPresent = hdp;
            halfDayAbsent = hda;
        }
    }

    @AuraEnabled(cacheable=false)
    public static RegCountsDTO getRegularizationCounts(Integer month, Integer year) {

        System.debug('=== START getRegularizationCounts ===');
        System.debug('Input month: ' + month + ', year: ' + year);

        // Create start & end dates for selected month
        Date startDate = Date.newInstance(year, month, 1);
        Date endDate   = startDate.addMonths(1);

        Id uid = UserInfo.getUserId();

        System.debug('=== REGULARIZATION COUNTS DEBUG ===');
        System.debug('User ID: ' + uid);
        System.debug('Month: ' + month + ', Year: ' + year);
        System.debug('Start Date: ' + startDate + ', End Date: ' + endDate);

        Map<String, Integer> byStatus = new Map<String, Integer>();
        Integer total = 0;

        // Aggregate counts for only the selected month using Check_in__c
        List<AggregateResult> results = [
            SELECT Approval_Status__c s, COUNT(Id) c
            FROM Regularization__c
            WHERE CreatedById = :uid
            AND Check_in__c >= :startDate
            AND Check_in__c < :endDate
            GROUP BY Approval_Status__c
        ];
        
        // If no results, try a broader date range to confirm data exists
        if (results.isEmpty()) {
            System.debug('No results with strict date range. Trying broader range...');
            results = [
                SELECT Approval_Status__c s, COUNT(Id) c
                FROM Regularization__c
                WHERE CreatedById = :uid
                AND Check_in__c >= :startDate.addMonths(-1)
                AND Check_in__c < :endDate.addMonths(1)
                GROUP BY Approval_Status__c
            ];
            System.debug('Broader range results: ' + results);
        }
        
        System.debug('Query Results: ' + results);
        
        for (AggregateResult ar : results) {
            String s = (String) ar.get('s');
            Integer c = (Integer) ar.get('c');
            System.debug('Status: ' + s + ', Count: ' + c);
            byStatus.put(s, c);
            total += c;
        }

        System.debug('By Status Map: ' + byStatus);
        System.debug('Total: ' + total);

        // Build DTO safely
        RegCountsDTO dto = new RegCountsDTO();
        dto.totalApplied = total;
        dto.approved = byStatus.containsKey('Approved') ? byStatus.get('Approved') : 0;
        dto.pending  = byStatus.containsKey('Pending')  ? byStatus.get('Pending')  : 0;
        dto.rejected = byStatus.containsKey('Rejected') ? byStatus.get('Rejected') : 0;

        System.debug('DTO: ' + dto);
        return dto;
    }

    @AuraEnabled(cacheable=true)
    public static AttendanceResult getAttendanceStats(Integer month, Integer year) {

        Date startDate = Date.newInstance(year, month, 1);
        Date endDate   = startDate.addMonths(1);

        Id uid = UserInfo.getUserId();

        Integer presentCount = [
            SELECT COUNT()
            FROM Attendance__c
            WHERE CreatedById = :uid
            AND Status__c = 'Present'
            AND Attendance_Date__c  >= :startDate
            AND Attendance_Date__c  < :endDate
        ];

        Integer absentCount = [
            SELECT COUNT()
            FROM Attendance__c
            WHERE CreatedById = :uid
            AND Status__c = 'Absent'
            AND Attendance_Date__c  >= :startDate
            AND Attendance_Date__c  < :endDate
        ];

        // Count half-day present records
        Integer halfDayPresentCount = [
            SELECT COUNT()
            FROM Attendance__c
            WHERE CreatedById = :uid
            AND Status__c = 'Half Day Present'
            AND Attendance_Date__c  >= :startDate
            AND Attendance_Date__c  < :endDate
        ];

        // Count half-day absent records
        Integer halfDayAbsentCount = [
            SELECT COUNT()
            FROM Attendance__c
            WHERE CreatedById = :uid
            AND Status__c = 'Half Day Absent'
            AND Attendance_Date__c  >= :startDate
            AND Attendance_Date__c  < :endDate
        ];

        return new AttendanceResult(presentCount, absentCount, halfDayPresentCount, halfDayAbsentCount);
    }
}