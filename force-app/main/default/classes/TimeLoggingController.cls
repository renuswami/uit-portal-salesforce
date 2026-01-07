/**
 * @description Controller class for Time Logging LWC component
 * @author UIT Project Management
 * @date 2024
 */
public with sharing class TimeLoggingController {
    
    /**
     * @description Get all active projects for the dropdown
     * @return List of Project__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<Project__c> getProjects() {
        try {
            return [
                SELECT Id, Name, Description__c, Status__c, Start_Date__c, End_Date__c
                FROM Project__c 
                WHERE Status__c != 'Completed' AND Status__c != 'Cancelled'
                ORDER BY Name ASC
                LIMIT 1000
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching projects: ' + e.getMessage());
        }
    }
    
    /**
     * @description Get tasks for a specific project assigned to current user
     * @param projectId The ID of the selected project
     * @return List of Project_Task__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<Project_Task__c> getTasksByProject(Id projectId) {
        try {
            Id currentUserId = UserInfo.getUserId();
            Project__c project = [
                SELECT Id, Name, Description__c, Status__c, Start_Date__c, End_Date__c
                FROM Project__c 
                WHERE Id = :projectId 
                LIMIT 1
            ];
            return [
                SELECT Id, Name, Description__c, Status__c, Priority__c, 
                       Due_Date__c, Estimated_Hours__c, Actual_Hours__c,
                       Project__r.Name,Related_Project__c
                FROM Project_Task__c 
                WHERE Related_Project__c = :project.Name
                AND Status__c != 'Completed'
                ORDER BY Priority__c DESC, Due_Date__c ASC
                LIMIT 1000
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching tasks: ' + e.getMessage());
        }
    }
    
    /**
     * @description Search tasks by name for lookup functionality
     * @param searchTerm The search term to filter tasks
     * @param projectId The ID of the selected project
     * @return List of Project_Task__c records matching the search
     */
    @AuraEnabled(cacheable=true)
    public static List<Project_Task__c> searchTasks(String searchTerm, Id projectId) {
        try {
            Id currentUserId = UserInfo.getUserId();
            String searchPattern = '%' + searchTerm + '%';
            Project__c project = [
                SELECT Id, Name, Description__c, Status__c, Start_Date__c, End_Date__c
                FROM Project__c 
                WHERE Id = :projectId 
                LIMIT 1
            ];
            return [
                SELECT Id, Name, Description__c, Status__c, Priority__c, 
                       Due_Date__c, Estimated_Hours__c, Actual_Hours__c,
                       Project__r.Name,Related_Project__c
                FROM Project_Task__c 
                WHERE Related_Project__c = :project.Name
                AND Name LIKE :searchPattern
                AND Status__c != 'Completed'
                ORDER BY Name ASC
                LIMIT 50
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error searching tasks: ' + e.getMessage());
        }
    }
    
    /**
     * @description Create a new time log entry
     * @param timeLogData The time log data to create
     * @return String success message or error
     */
    @AuraEnabled
    public static String createTimeLog(TimeLogWrapper timeLogData) {
        try {
            // Validate input data
            if (timeLogData.taskId == null) {
                throw new AuraHandledException('Task is required');
            }
            if (timeLogData.hours == null || timeLogData.hours <= 0) {
                throw new AuraHandledException('Hours must be greater than 0');
            }
            if (timeLogData.logDate == null) {
                throw new AuraHandledException('Date is required');
            }
            
            // Verify task exists and user has access
            List<Project_Task__c> tasks = [
                SELECT Id, Name, Project__r.Name 
                FROM Project_Task__c 
                WHERE Id = :timeLogData.taskId
                LIMIT 1
            ];
            
            if (tasks.isEmpty()) {
                throw new AuraHandledException('Task not found or access denied');
            }
            
            // Create time log record
          /*  Time_Log__c timeLog = new Time_Log__c(
                Task__c = timeLogData.taskId,
                Hours__c = timeLogData.hours,
                Date__c = timeLogData.logDate,
                Description__c = timeLogData.description,
                Billable__c = timeLogData.billable
            );
            
            insert timeLog; */

            Time_Log__c timeLog = new Time_Log__c();

                timeLog.Task__c = timeLogData.taskId;
                timeLog.Date__c = timeLogData.logDate;
                timeLog.Description__c = timeLogData.description;
                timeLog.Billable__c = timeLogData.billable;

            if (timeLogData.billable == false) {
                timeLog.Non_Billable__c = timeLogData.hours;
            } else {
                timeLog.Hours__c = timeLogData.hours;
            }

            insert timeLog;
            return 'Time log created successfully for ' + timeLogData.hours + ' hours on ' + tasks[0].Name;
            
        } catch (DmlException e) {
            throw new AuraHandledException('Error creating time log: ' + e.getDmlMessage(0));
        } catch (Exception e) {
            throw new AuraHandledException('Error creating time log: ' + e.getMessage());
        }
    }
    
    /**
     * @description Get recent time logs for the current user
     * @param limitCount Number of records to return
     * @return List of recent time logs
     */
    @AuraEnabled(cacheable=true)
    public static List<TimeLogDisplayWrapper> getRecentTimeLogs(Integer limitCount) {
        try {
            Id currentUserId = UserInfo.getUserId();
            Integer recordLimit = limitCount != null ? limitCount : 10;
            
            List<Time_Log__c> timeLogs = [
                SELECT Id, Name, Hours__c, Date__c, Description__c, Billable__c,
                       Task__r.Name, Task__r.Project__r.Name,
                       CreatedDate
                FROM Time_Log__c 
                WHERE Task__r.Assigned_To__c = :currentUserId
                ORDER BY CreatedDate DESC
                LIMIT :recordLimit
            ];
            
            List<TimeLogDisplayWrapper> displayLogs = new List<TimeLogDisplayWrapper>();
            for (Time_Log__c log : timeLogs) {
                displayLogs.add(new TimeLogDisplayWrapper(log));
            }
            
            return displayLogs;
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching recent time logs: ' + e.getMessage());
        }
    }
    
    /**
     * @description Wrapper class for time log creation
     */
    public class TimeLogWrapper {
        @AuraEnabled public Id taskId { get; set; }
        @AuraEnabled public Decimal hours { get; set; }
        @AuraEnabled public Date logDate { get; set; }
        @AuraEnabled public String description { get; set; }
        @AuraEnabled public Boolean billable { get; set; }
    }
    
    /**
     * @description Wrapper class for displaying time logs
     */
    public class TimeLogDisplayWrapper {
        @AuraEnabled public Id id { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public Decimal hours { get; set; }
        @AuraEnabled public Date logDate { get; set; }
        @AuraEnabled public String description { get; set; }
        @AuraEnabled public Boolean billable { get; set; }
        @AuraEnabled public String taskName { get; set; }
        @AuraEnabled public String projectName { get; set; }
        @AuraEnabled public DateTime createdDate { get; set; }
        
        public TimeLogDisplayWrapper(Time_Log__c timeLog) {
            this.id = timeLog.Id;
            this.name = timeLog.Name;
            this.hours = timeLog.Hours__c;
            this.logDate = timeLog.Date__c;
            this.description = timeLog.Description__c;
            this.billable = timeLog.Billable__c;
            this.taskName = timeLog.Task__r.Name;
            this.projectName = timeLog.Task__r.Project__r.Name;
            this.createdDate = timeLog.CreatedDate;
        }
    }
}