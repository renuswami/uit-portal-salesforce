public with sharing class ProjectDashboardController {

    /**
     * Wrapper class to hold data for a SINGLE project
     */
    public class ProjectSummary {
        @AuraEnabled public Id projectId { get; set; }
        @AuraEnabled public String projectName { get; set; }
        @AuraEnabled public Decimal projectTotalBillable { get; set; }
        @AuraEnabled public Decimal projectTotalNonBillable { get; set; }
        @AuraEnabled public List<UserSummary> userSummaries { get; set; }
    }

    /**
     * Wrapper class for each user's summary
     */
    public class UserSummary {
        @AuraEnabled public Id userId { get; set; }
        @AuraEnabled public String userName { get; set; }
        @AuraEnabled public Decimal userTotalBillable { get; set; }
        @AuraEnabled public Decimal userTotalNonBillable { get; set; }
    }

    /**
     * @description Main method called by the LWC.
     * @return A list of summaries, one for each project.
     */
    @AuraEnabled(cacheable=true)
    public static List<ProjectSummary> getAllProjectDashboardData() {
        
        Map<Id, ProjectSummary> projectSummaryMap = new Map<Id, ProjectSummary>();

        // **** FIX IS HERE IN THE QUERY ****
        List<AggregateResult> results = [
            SELECT 
                Project__c, 
                Project__r.Name projectName,  // <-- CHANGED: Added alias
                Assigned_To__c, 
                Assigned_To__r.Name userName,   // <-- CHANGED: Added alias
                SUM(Total_Task_Hours__c) billable, 
                SUM(Total_Non_Billable_Task_Hours__c) nonBillable 
            FROM Project_Task__c 
            WHERE Assigned_To__c != null AND Project__c != null
            GROUP BY Project__c, Project__r.Name, Assigned_To__c, Assigned_To__r.Name
            ORDER BY Project__r.Name, Assigned_To__r.Name
        ];

        // **** AND FIX IS HERE IN THE LOOP ****
        for (AggregateResult ar : results) {
            Id projectId = (Id)ar.get('Project__c');
            String projectName = (String)ar.get('projectName'); // <-- CHANGED: Use alias
            Id userId = (Id)ar.get('Assigned_To__c');
            String userName = (String)ar.get('userName'); // <-- CHANGED: Use alias
            
            // Handle nulls before casting to Decimal
            Decimal userBillable = (Decimal)ar.get('billable');
            userBillable = (userBillable == null) ? 0 : userBillable;

            Decimal userNonBillable = (Decimal)ar.get('nonBillable');
            userNonBillable = (userNonBillable == null) ? 0 : userNonBillable;


            // Check if we have already started this Project's summary
            ProjectSummary summary = projectSummaryMap.get(projectId);
            
            if (summary == null) {
                // First time seeing this project. Create a new summary object.
                summary = new ProjectSummary();
                summary.projectId = projectId;
                summary.projectName = projectName;
                summary.projectTotalBillable = 0;
                summary.projectTotalNonBillable = 0;
                summary.userSummaries = new List<UserSummary>();
                
                // Add it to the map
                projectSummaryMap.put(projectId, summary);
            }

            // Create the UserSummary for this user
            UserSummary us = new UserSummary();
            us.userId = userId;
            us.userName = userName;
            us.userTotalBillable = userBillable;
            us.userTotalNonBillable = userNonBillable;

            // Add this user's summary to the project's list
            summary.userSummaries.add(us);

            // Add this user's totals to the project's grand totals
            summary.projectTotalBillable += userBillable;
            summary.projectTotalNonBillable += userNonBillable;
        }

        // Return the list of all project summaries
        return projectSummaryMap.values();
    }
}