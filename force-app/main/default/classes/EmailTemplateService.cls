public with sharing class EmailTemplateService {

    public class TemplateOption {
        @AuraEnabled public String label;
        @AuraEnabled public String value;

        public TemplateOption(String label, String value) {
            this.label = label;
            this.value = value;
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<TemplateOption> getAvailableTemplates() {
        List<TemplateOption> options = new List<TemplateOption>();
        for (EmailTemplate template : [SELECT Id, Name FROM EmailTemplate 
                                       WHERE IsActive = true 
                                       ORDER BY Name LIMIT 100]) {
            options.add(new TemplateOption(template.Name, template.Id)); 
        }
        return options;
    }

    @AuraEnabled
    public static String renderTemplate(Id templateId, Id candidateId) {
        try {
            Messaging.SingleEmailMessage email = Messaging.renderStoredEmailTemplate(templateId, UserInfo.getUserId(), candidateId);
            return email.getHtmlBody();
            
        } catch (Exception e) {
            throw new AuraHandledException('Rendering failed: ' + e.getMessage());
        }
    }
}