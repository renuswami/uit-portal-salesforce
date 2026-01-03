public with sharing class TimeLogSummaryController {
    @AuraEnabled(cacheable=true)
    public static List<TimeLogSummaryWrapper> getTimeLogSummaries(Date startDate, Date endDate, String cacheBuster) {
        Map<Id, TimeLogSummaryWrapper> summaryMap = new Map<Id, TimeLogSummaryWrapper>();
        
        try {
            // 1. Get All Logs (Grouped by Employee)
            for (AggregateResult ar : [
                SELECT CreatedById, CreatedBy.Name empName, 
                       SUM(Hours__c) totalBillable, 
                       SUM(Non_Billable__c) totalNonBillable
                FROM Time_Log__c
                WHERE Date__c >= :startDate AND Date__c <= :endDate
                GROUP BY CreatedById, CreatedBy.Name
                ORDER BY CreatedBy.Name
            ]) {
                Id empId = (Id)ar.get('CreatedById');
                summaryMap.put(empId, new TimeLogSummaryWrapper(
                    (String)ar.get('empName'),
                    (Decimal)ar.get('totalBillable'),
                    (Decimal)ar.get('totalNonBillable'),
                    0 // Initialize approved hours to 0
                ));
            }

            // 2. Get Approved Logs Only using Approved_Logged_Hours__c
            for (AggregateResult ar : [
                SELECT CreatedById, 
                       SUM(Approved_Logged_Hours__c) totalApproved
                FROM Time_Log__c
                WHERE Date__c >= :startDate AND Date__c <= :endDate
                GROUP BY CreatedById
            ]) {
                Id empId = (Id)ar.get('CreatedById');
                if (summaryMap.containsKey(empId)) {
                    Decimal approvedHours = (Decimal)ar.get('totalApproved');
                    summaryMap.get(empId).totalApprovedHours = approvedHours != null ? approvedHours : 0;
                }
            }
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
        
        return summaryMap.values();
    }

    @AuraEnabled(cacheable=true)
    public static String getEmployeeReportId(String employeeName) {
        try {
            String searchKey = '%' + employeeName + '%';
            String allocationKey = '%Allocation%';
            List<Report> reports = [SELECT Id FROM Report WHERE Name LIKE :searchKey AND Name LIKE :allocationKey LIMIT 1];
            if (!reports.isEmpty()) {
                return reports[0].Id;
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    @AuraEnabled(cacheable=true)
    public static String getAttendanceReportId(String employeeName) {
        try {
            String reportName = employeeName + ' Attendance Report';
            List<Report> reports = [SELECT Id FROM Report WHERE Name = :reportName LIMIT 1];
            if (!reports.isEmpty()) {
                return reports[0].Id;
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }
    
    public class TimeLogSummaryWrapper {
        @AuraEnabled public String employeeName;
        @AuraEnabled public Decimal totalBillable;
        @AuraEnabled public Decimal totalNonBillable;
        @AuraEnabled public Decimal totalHours;
        @AuraEnabled public Decimal totalApprovedHours;
        
        public TimeLogSummaryWrapper(String name, Decimal billable, Decimal nonBillable, Decimal approvedHours) {
            this.employeeName = name;
            this.totalBillable = billable != null ? billable : 0;
            this.totalNonBillable = nonBillable != null ? nonBillable : 0;
            this.totalHours = this.totalBillable + this.totalNonBillable;
            this.totalApprovedHours = approvedHours != null ? approvedHours : 0;
        }
    }
}