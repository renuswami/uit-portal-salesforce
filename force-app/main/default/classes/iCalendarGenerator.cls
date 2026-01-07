public with sharing class iCalendarGenerator {

    @AuraEnabled
    public static void sendInvite(
        String subject, 
        String startStr, 
        String endStr, 
        String location, 
        String recipientEmail, 
        String candidateId, 
        String finalEmailBody
    ) {
        if (String.isBlank(startStr)) throw new AuraHandledException('Dates are missing.');

        // Replace with your verified Org-Wide Email
        List<OrgWideEmailAddress> owea = [SELECT Id FROM OrgWideEmailAddress WHERE Address = 'hr@untangleit.in' LIMIT 1];

        DateTime startDt = (DateTime)JSON.deserialize('"' + startStr + '"', DateTime.class);
        DateTime endDt = (DateTime)JSON.deserialize('"' + endStr + '"', DateTime.class);

        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        if (!owea.isEmpty()) mail.setOrgWideEmailAddressId(owea[0].Id);
        
        mail.setToAddresses(new List<String>{ recipientEmail });
        mail.setSubject(subject);
        mail.setHtmlBody(finalEmailBody);

        String startIcs = startDt.formatGmt('yyyyMMdd\'T\'HHmmss\'Z\'');
        String endIcs = endDt.formatGmt('yyyyMMdd\'T\'HHmmss\'Z\'');
        String uid = Crypto.getRandomLong() + '@salesforce.com';

        String icsBody = 'BEGIN:VCALENDAR\nVERSION:2.0\nMETHOD:REQUEST\nBEGIN:VEVENT\n' +
                         'UID:' + uid + '\n' +
                         'DTSTAMP:' + startIcs + '\n' +
                         'DTSTART:' + startIcs + '\n' +
                         'DTEND:' + endIcs + '\n' +
                         'SUMMARY:' + subject + '\n' +
                         'LOCATION:' + location + '\n' +
                         'END:VEVENT\nEND:VCALENDAR';

        Messaging.EmailFileAttachment attach = new Messaging.EmailFileAttachment();
        attach.setFileName('invite.ics');
        attach.setBody(Blob.valueOf(icsBody));
        attach.setContentType('text/calendar; charset=UTF-8; method=REQUEST');
        mail.setFileAttachments(new Messaging.EmailFileAttachment[]{attach});

        Messaging.sendEmail(new Messaging.SingleEmailMessage[] { mail });
    }
}