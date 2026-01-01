public with sharing class TimeLogSummaryController {
    @AuraEnabled(cacheable=true)
    public static List<TimeLogSummaryWrapper> getTimeLogSummaries(Date startDate, Date endDate) {
        List<TimeLogSummaryWrapper> summaries = new List<TimeLogSummaryWrapper>();
        
        try {
            for (AggregateResult ar : [
                SELECT CreatedById, CreatedBy.Name empName, 
                       SUM(Hours__c) totalBillable, 
                       SUM(Non_Billable__c) totalNonBillable
                FROM Time_Log__c
                WHERE Date__c >= :startDate AND Date__c <= :endDate
                GROUP BY CreatedById, CreatedBy.Name
                ORDER BY CreatedBy.Name
            ]) {
                summaries.add(new TimeLogSummaryWrapper(
                    (String)ar.get('empName'),
                    (Decimal)ar.get('totalBillable'),
                    (Decimal)ar.get('totalNonBillable')
                ));
            }
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
        
        return summaries;
    }
    
    public class TimeLogSummaryWrapper {
        @AuraEnabled public String employeeName;
        @AuraEnabled public Decimal totalBillable;
        @AuraEnabled public Decimal totalNonBillable;
        @AuraEnabled public Decimal totalHours;
        
        public TimeLogSummaryWrapper(String name, Decimal billable, Decimal nonBillable) {
            this.employeeName = name;
            this.totalBillable = billable != null ? billable : 0;
            this.totalNonBillable = nonBillable != null ? nonBillable : 0;
            this.totalHours = this.totalBillable + this.totalNonBillable;
        }
    }
}
