public with sharing class ProjectHierarchyController {
    
    @AuraEnabled(cacheable=true)
    public static List<ProjectWrapper> getProjectHierarchy() {
        List<ProjectWrapper> projectList = new List<ProjectWrapper>();
        Map<Id, ProjectWrapper> projectMap = new Map<Id, ProjectWrapper>();
        Map<Id, TaskWrapper> taskMap = new Map<Id, TaskWrapper>();
        List<Project_Task__c> allTasks = new List<Project_Task__c>();
        
        try {
            // 1. Fetch Projects
            List<Project__c> projects = [SELECT Id, Name FROM Project__c ORDER BY Name];
            for (Project__c p : projects) {
                ProjectWrapper pw = new ProjectWrapper(p);
                projectList.add(pw);
                projectMap.put(p.Id, pw);
            }
            
            // 2. Fetch All Project Tasks
            allTasks = [
                SELECT Id, Name, Project__c, Project_Task__c, Project_Task__r.Name,
                       Status__c, Assigned_To__c, Assigned_To__r.Name, 
                       Due_Date__c, Description__c, Priority__c,
                       Estimated_Hours__c, Actual_Hours__c,
                       Approved_Logged_Hours__c,
                       Related_Project__c,
                       Actual_Non_Billable_Hours__c,
                       Total_Sub_Task_Hours__c,
                       Total_Sub_Task_Non_Billable_Hours__c
                FROM Project_Task__c 
                WHERE Project__c IN :projectMap.keySet()
                   OR Project_Task__r.Project__c IN :projectMap.keySet()
                ORDER BY CreatedDate
            ];
            
            // 3. Organize Tasks into Hierarchy
            List<TaskWrapper> rootTasks = new List<TaskWrapper>();
            
            // First pass: Create Wrappers and identify root tasks (no parent)
            for (Project_Task__c task : allTasks) {
                TaskWrapper tw = new TaskWrapper(task);
                taskMap.put(task.Id, tw);
            }
            
            // Second pass: Build relationship
            for (Project_Task__c task : allTasks) {
                TaskWrapper tw = taskMap.get(task.Id);
                // Use Project_Task__c as the parent pointer based on provided schema
                if (task.Project_Task__c == null) {
                    // Level 2: Project Task (Direct child of Project)
                    if (projectMap.containsKey(task.Project__c)) {
                        projectMap.get(task.Project__c).projectTasks.add(tw);
                    }
                } else {
                    // Level 3: Sub Task (Child of another Task)
                    if (taskMap.containsKey(task.Project_Task__c)) {
                        taskMap.get(task.Project_Task__c).subTasks.add(tw);
                    }
                }
            }
            
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching project hierarchy: ' + e.getMessage());
        }
        
        return projectList;
    }
    
    public class ProjectWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String status;
        @AuraEnabled public Date startDate;
        @AuraEnabled public Date endDate;
        @AuraEnabled public List<TaskWrapper> projectTasks;
        
        public ProjectWrapper(Project__c p) {
            this.id = p.Id;
            this.name = p.Name;
            // Added based on Project__c schema provided
            // Assuming we might want to show these at project level too, but requirement focused on list
            this.projectTasks = new List<TaskWrapper>();
        }
    }
    
    public class TaskWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String status;
        @AuraEnabled public String assignedTo;
        @AuraEnabled public String assignedToName;
        @AuraEnabled public Date dueDate;
        @AuraEnabled public String priority;
        @AuraEnabled public String description;
        @AuraEnabled public Decimal estimatedHours;
        @AuraEnabled public Decimal actualHours; // Billable
        @AuraEnabled public List<TaskWrapper> subTasks;
        @AuraEnabled public Project_Task__c record; 

        // New Fields
        @AuraEnabled public String parentTaskName;
        @AuraEnabled public String relatedProject;
        @AuraEnabled public Decimal approvedLoggedHours;
        @AuraEnabled public Decimal actualNonBillableHours;
        @AuraEnabled public Decimal totalSubTaskHours; // Billable
        @AuraEnabled public Decimal totalSubTaskNonBillableHours;
        
        public TaskWrapper(Project_Task__c t) {
            this.id = t.Id;
            this.name = t.Name;
            this.status = t.Status__c;
            this.assignedTo = t.Assigned_To__c;
            this.assignedToName = t.Assigned_To__r != null ? t.Assigned_To__r.Name : '';
            this.dueDate = t.Due_Date__c;
            this.priority = t.Priority__c;
            this.description = t.Description__c;
            this.estimatedHours = t.Estimated_Hours__c;
            this.actualHours = t.Actual_Hours__c; // Time Log Billable
            this.subTasks = new List<TaskWrapper>();
            this.record = t;

            // Map New Fields
            this.parentTaskName = t.Project_Task__r != null ? t.Project_Task__r.Name : '';
            this.relatedProject = t.Related_Project__c;
            this.approvedLoggedHours = t.Approved_Logged_Hours__c;
            this.actualNonBillableHours = t.Actual_Non_Billable_Hours__c;
            this.totalSubTaskHours = t.Total_Sub_Task_Hours__c;
            this.totalSubTaskNonBillableHours = t.Total_Sub_Task_Non_Billable_Hours__c;
        }
    }
}