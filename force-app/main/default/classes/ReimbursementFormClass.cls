public class ReimbursementFormClass {
    
    @AuraEnabled
    public static void DuplicateCheck(Expense__c Exp){
        List<Expense__c> Exp1 = [Select Id,Name from Expense__c where Date_of_Expense__c=:Exp.Date_of_Expense__c AND Amount__c=:Exp.Amount__c];
        if(Exp1!=null){
            ApexPages.addMessage(new ApexPages.Message(ApexPages.Severity.Warning, 'There is already an Expense Listed with similar details.'));
        }
    }

}