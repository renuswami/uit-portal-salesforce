public with sharing class WeeklyTimeLogController {
    
    @AuraEnabled(cacheable=true)
    public static WeeklyTimeLogResponse getWeeklyTimeLogs(Date selectedDate) {
        try {
            // Validate input parameter
            if (selectedDate == null) {
                selectedDate = Date.today();
            }
            
            // Calculate the Monday and Sunday of the selected week
            Date weekStart = getWeekStart(selectedDate);
            Date weekEnd = getWeekEnd(weekStart);
            
            // Get current user ID
            Id currentUserId = UserInfo.getUserId();
            
            // Query time logs for the week
            List<Time_Log__c> timeLogs = [
                SELECT Id, Date__c, Hours__c, Project__c, Task__c, Task__r.Project__c, Task__r.Project__r.Name, 
                       Billable__c, Non_Billable__c, CreatedById
                FROM Time_Log__c 
                WHERE CreatedById = :currentUserId 
                AND Date__c >= :weekStart 
                AND Date__c <= :weekEnd
                AND Task__c != null
                AND Task__r.Project__c != null
                ORDER BY Task__r.Project__r.Name, Date__c
            ];
            
            // Process and group the data
            WeeklyTimeLogResponse response = new WeeklyTimeLogResponse();
            response.weekStart = weekStart;
            response.weekEnd = weekEnd;
            response.projectSummaries = processTimeLogData(timeLogs, weekStart);
            response.hasData = !timeLogs.isEmpty();
            
            return response;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving time logs: ' + e.getMessage());
        }
    }
    
    private static Date getWeekStart(Date selectedDate) {
        // Get the Monday of the week containing the selected date
        Integer dayOfWeek = Math.mod(Date.newInstance(1900, 1, 7).daysBetween(selectedDate), 7);
        return selectedDate.addDays(-dayOfWeek);
    }
    
    private static Date getWeekEnd(Date weekStart) {
        // Sunday is 6 days after Monday
        return weekStart.addDays(6);
    }
    
    private static List<ProjectSummary> processTimeLogData(List<Time_Log__c> timeLogs, Date weekStart) {
        Map<Id, ProjectSummary> projectMap = new Map<Id, ProjectSummary>();
        
        for (Time_Log__c log : timeLogs) {
            Id projectId = log.Task__r.Project__c;
            
            // Initialize project summary if not exists
            if (!projectMap.containsKey(projectId)) {
                ProjectSummary summary = new ProjectSummary();
                summary.projectId = projectId;
                summary.projectName = log.Task__r.Project__r.Name;
                summary.dailyHours = initializeDailyHours();
                summary.totalBillableHours = 0;
                summary.totalNonBillableHours = 0;
                projectMap.put(projectId, summary);
            }
            
            ProjectSummary summary = projectMap.get(projectId);
            
            // Calculate day index (0 = Monday, 6 = Sunday)
            Integer dayIndex = weekStart.daysBetween(log.Date__c);
            
            if (dayIndex >= 0 && dayIndex <= 6) {
                DayHours dayHours = summary.dailyHours[dayIndex];
                
                // Handle billable and non-billable hours using dedicated fields
                if (log.Non_Billable__c != null && log.Non_Billable__c > 0) {
                    // Use Non_Billable__c field for non-billable hours
                    dayHours.nonBillableHours += log.Non_Billable__c;
                    summary.totalNonBillableHours += log.Non_Billable__c;
                }
                
                // Check if it's billable using the Billable__c checkbox
                if (log.Billable__c != null && log.Billable__c && log.Hours__c != null) {
                    dayHours.billableHours += log.Hours__c;
                    summary.totalBillableHours += log.Hours__c;
                }
            }
        }
        
        return projectMap.values();
    }
    
    private static List<DayHours> initializeDailyHours() {
        List<DayHours> dailyHours = new List<DayHours>();
        List<String> dayNames = new List<String>{'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'};
        
        for (String dayName : dayNames) {
            DayHours dayHour = new DayHours();
            dayHour.dayName = dayName;
            dayHour.billableHours = 0;
            dayHour.nonBillableHours = 0;
            dailyHours.add(dayHour);
        }
        
        return dailyHours;
    }
    
    // Wrapper classes for response
    public class WeeklyTimeLogResponse {
        @AuraEnabled public Date weekStart { get; set; }
        @AuraEnabled public Date weekEnd { get; set; }
        @AuraEnabled public List<ProjectSummary> projectSummaries { get; set; }
        @AuraEnabled public Boolean hasData { get; set; }
    }
    
    public class ProjectSummary {
        @AuraEnabled public Id projectId { get; set; }
        @AuraEnabled public String projectName { get; set; }
        @AuraEnabled public List<DayHours> dailyHours { get; set; }
        @AuraEnabled public Decimal totalBillableHours { get; set; }
        @AuraEnabled public Decimal totalNonBillableHours { get; set; }
        @AuraEnabled public Decimal grandTotal { 
            get { 
                return (totalBillableHours != null ? totalBillableHours : 0) + 
                       (totalNonBillableHours != null ? totalNonBillableHours : 0); 
            } 
        }
    }
    
    public class DayHours {
        @AuraEnabled public String dayName { get; set; }
        @AuraEnabled public Decimal billableHours { get; set; }
        @AuraEnabled public Decimal nonBillableHours { get; set; }
        @AuraEnabled public Decimal dayTotal { 
            get { 
                return (billableHours != null ? billableHours : 0) + 
                       (nonBillableHours != null ? nonBillableHours : 0); 
            } 
        }
    }
}