public class ProjectTaskHandler {

    private static boolean hasRun = false;

    public static void recalculateParentHours(List<Project_Task__c> newTasks, Map<Id, Project_Task__c> oldTaskMap) {
        
        if (hasRun) {
            return;
        }
        hasRun = true;

        Set<Id> parentTaskIds = new Set<Id>();

        // Collect parent IDs from new/updated records
        if (newTasks != null) {
            for (Project_Task__c task : newTasks) {
                if (task.Project_Task__c != null) {
                    parentTaskIds.add(task.Project_Task__c);
                }
                if (oldTaskMap != null && oldTaskMap.containsKey(task.Id) && oldTaskMap.get(task.Id).Project_Task__c != null) {
                    parentTaskIds.add(oldTaskMap.get(task.Id).Project_Task__c);
                }
            }
        }

        // Collect parent IDs from deleted records
        if (Trigger.isDelete && oldTaskMap != null) {
             for (Project_Task__c task : oldTaskMap.values()) {
                if (task.Project_Task__c != null) {
                    parentTaskIds.add(task.Project_Task__c);
                }
            }
        }
        
        if (parentTaskIds.isEmpty()) {
            return;
        }

        // === MODIFICATION 1: Update the Query ===
        // Add SUM(Actual_Non_Billable_Hours__c)
        AggregateResult[] groupedResults = [
            SELECT 
                Project_Task__c, 
                SUM(Actual_Hours__c) totalHours, 
                SUM(Actual_Non_Billable_Hours__c) totalNonBillable, // <-- ADD THIS
                COUNT(Id) childCount
            FROM Project_Task__c
            WHERE Project_Task__c IN :parentTaskIds
            GROUP BY Project_Task__c
        ];

        Map<Id, Decimal> parentHoursMap = new Map<Id, Decimal>();
        Map<Id, Integer> childCountMap = new Map<Id, Integer>();
        
        // === MODIFICATION 2: Create a new Map for Non-Billable ===
        Map<Id, Decimal> parentNonBillableMap = new Map<Id, Decimal>();

        for (AggregateResult ar : groupedResults) {
            Id parentId = (Id)ar.get('Project_Task__c');
            Decimal totalHours = (Decimal)ar.get('totalHours');
            Integer childCount = (Integer)ar.get('childCount');
            
            // === MODIFICATION 3: Get the new Non-Billable sum ===
            Decimal totalNonBillable = (Decimal)ar.get('totalNonBillable'); // <-- ADD THIS
            
            parentHoursMap.put(parentId, (totalHours == null ? 0 : totalHours));    
            childCountMap.put(parentId, childCount);
            
            // === MODIFICATION 4: Populate the new Map ===
            parentNonBillableMap.put(parentId, (totalNonBillable == null ? 0 : totalNonBillable)); // <-- ADD THIS
        }

        List<Project_Task__c> tasksToUpdate = new List<Project_Task__c>();
        
        for (Id parentId : parentTaskIds) {
            Decimal total = parentHoursMap.containsKey(parentId) ? parentHoursMap.get(parentId) : 0;
            Integer count = childCountMap.containsKey(parentId) ? childCountMap.get(parentId) : 0;
            
            // === MODIFICATION 5: Get the new Non-Billable total ===
            Decimal totalNonBillable = parentNonBillableMap.containsKey(parentId) ? parentNonBillableMap.get(parentId) : 0; // <-- ADD THIS

            tasksToUpdate.add(new Project_Task__c(
                Id = parentId,    
                Total_Sub_Task_Hours__c = total,
                Sub_Task_Count__c = count,
                
                // === MODIFICATION 6: Add the new field to the update ===
                Total_Sub_Task_Non_Billable_Hours__c = totalNonBillable // <-- ADD THIS
            ));
        }

        if (!tasksToUpdate.isEmpty()) {
            update tasksToUpdate;
        }
    }
}