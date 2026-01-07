public with sharing class WorkSessionController {
    
    @AuraEnabled(cacheable=true)
    public static List<Work_Session__c> getRecentSessions() {
        try {
            return [
                SELECT Id, Name, Check_In__c, Check_Out__c, Duration_Hours__c, Status__c, Account__c, Account__r.Name
                FROM Work_Session__c 
                WHERE User__c = :UserInfo.getUserId() 
                ORDER BY Check_In__c DESC 
                LIMIT 100
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving sessions: ' + e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static Work_Session__c getCurrentSession() {
        try {
            List<Work_Session__c> activeSessions = [
                SELECT Id, Name, Check_In__c, Status__c, Account__c, Account__r.Name
                FROM Work_Session__c 
                WHERE User__c = :UserInfo.getUserId() AND Status__c = 'Checked In' 
                LIMIT 1
            ];
            return activeSessions.isEmpty() ? null : activeSessions[0];
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving current session: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static Work_Session__c checkIn(Id accountId, String photoBase64, String clientIp) {
        // validateIpUsingClientIp(clientIp);
        try {
            List<Work_Session__c> existingSessions = [SELECT Id FROM Work_Session__c WHERE User__c = :UserInfo.getUserId() AND Status__c = 'Checked In' LIMIT 1];
            if (!existingSessions.isEmpty()) {
                throw new AuraHandledException('You are already checked in. Please check out first.');
            }
            if (accountId == null) {
                User u = [SELECT Contact.AccountId FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
                if (u.Contact?.AccountId != null) {
                    accountId = u.Contact.AccountId;
                } else {
                    throw new AuraHandledException('Could not find a related employee account.');
                }
            }
            Date today = System.today();
            Attendance__c parentAttendance;
            try {
                parentAttendance = [SELECT Id FROM Attendance__c 
                                    WHERE Employee__c = :accountId 
                                    AND Attendance_Date__c = :today
                                    LIMIT 1];
            } catch (Exception e) {
                System.debug('catch block is executed');
                parentAttendance = new Attendance__c(
                    Employee__c = accountId,
                    Attendance_Date__c = today
                );
                insert parentAttendance;
            }
            Work_Session__c session = new Work_Session__c(
                User__c = UserInfo.getUserId(),
                Account__c = accountId, 
                Check_In__c = System.now(),
                Status__c = 'Checked In',
                Attendance__c = parentAttendance.Id
            );
            insert session;
            if (String.isNotBlank(photoBase64)) {
                createPhotoAttachment(session.Id, photoBase64, 'CheckIn');
            }
            return [
                SELECT Id, Name, Check_In__c, Status__c, Account__c, Account__r.Name
                FROM Work_Session__c 
                WHERE Id = :session.Id
            ][0];
        } catch (Exception e) {
            throw new AuraHandledException('Error checking in: ' + e.getMessage());
        }
    }
    
    @AuraEnabled
    public static Work_Session__c checkOut(String photoBase64, String clientIp) {
        // validateIpUsingClientIp(clientIp);
        try {
            List<Work_Session__c> activeSessions = [
                SELECT Id, Check_In__c 
                FROM Work_Session__c 
                WHERE User__c = :UserInfo.getUserId() 
                AND Status__c = 'Checked In' 
                LIMIT 1
            ];
            
            if (activeSessions.isEmpty()) {
                throw new AuraHandledException('No active session found. Please check in first.');
            }
            
            // Step 2: Validate previous day hours
            validatePreviousDayLog();
            
            // Step 3: Proceed with checkout
            Work_Session__c session = activeSessions[0];
            session.Check_Out__c = System.now();
            session.Status__c = 'Checked Out';
            update session;
            
            // Step 4: Save checkout photo if provided
            if (String.isNotBlank(photoBase64)) {
                createPhotoAttachment(session.Id, photoBase64, 'CheckOut');
            }
            
            // Step 5: Return updated record
            return [
                SELECT Id, Name, Check_In__c, Check_Out__c, Duration_Hours__c, Status__c, 
                Account__c, Account__r.Name
                FROM Work_Session__c 
                WHERE Id = :session.Id
            ][0];
            
        } catch (AuraHandledException ahe) {
            throw ahe;
        } catch (Exception e) {
            throw new AuraHandledException('Error checking out: ' + e.getMessage());
        }
    }
    
    private static void validatePreviousDayLog() {
        Date today = Date.today();
        Date checkDate = today.addDays(-1);
        
        // Loop until we find a real working day
        while (true) {
            // Convert Date → DateTime so we can use format() even in older orgs
            DateTime dt = DateTime.newInstance(checkDate, Time.newInstance(0,0,0,0));
            String dayName = dt.format('E');   // Sun, Mon, Tue, Wed, Thu, Fri, Sat
            
            // Skip Sunday
            if (dayName == 'Sun') {
                checkDate = checkDate.addDays(-1);
                continue;
            }
            
            // Skip Holidays
            Integer holidayCount = [
                SELECT COUNT()
                FROM Holiday__c
                WHERE Date__c = :checkDate
            ];
            
            if (holidayCount > 0) {
                checkDate = checkDate.addDays(-1);
                continue;
            }
            
            Id userAccountId = [SELECT Contact.AccountId FROM User WHERE Id = :UserInfo.getUserId()].Contact.AccountId;
            
            Integer leaveCount = [
                SELECT COUNT()
                FROM Leave__c
                WHERE Employee__c = :userAccountId
                AND Start_Date__c <= :checkDate
                AND End_Date__c >= :checkDate
            ];
            
            if (leaveCount > 0) {
                // User was on leave → no need to check logs
                return;
            }
            // If we reach here → we found the last working day
            break;
        }
        
        // ---- Step 1: Calculate total WORKED hours from sessions ----
        DateTime startOfDay = DateTime.newInstance(checkDate, Time.newInstance(0, 0, 0, 0));
        DateTime endOfDay   = startOfDay.addDays(1);
        
        AggregateResult[] workResults = [
            SELECT SUM(Duration_Hours__c) totalWorked
            FROM Work_Session__c
            WHERE User__c = :UserInfo.getUserId()
            AND Check_In__c >= :startOfDay
            AND Check_In__c < :endOfDay
            AND Status__c = 'Checked Out'
        ];
        
        Decimal workedHours = 0;
        if (!workResults.isEmpty()) {
            workedHours = (Decimal) workResults[0].get('totalWorked');
            workedHours = workedHours != null ? workedHours : 0;
        }
        
        
        // Now check if log exists for that working day
        Integer logCount = [
            SELECT COUNT()
            FROM Time_Log__c
            WHERE CreatedById = :UserInfo.getUserId()
            AND Date__c = :checkDate
        ];
        
        if (logCount == 0) {
            throw new AuraHandledException(
                'You have not logged hours for previous working day (' +
                checkDate.format() + '). Please complete it before checkout.'
            );
        } 
        
        // Calculate Total Hours (Billable + Non-Billable) directly in the query
        AggregateResult[] groupedResults = [
            SELECT SUM(Hours__c) billable, 
            SUM(Non_Billable__c) nonBillable
            FROM Time_Log__c 
            WHERE CreatedById = :UserInfo.getUserId() 
            AND Date__c = :checkDate
        ];
        
        Decimal totalHours = 0;
        if (groupedResults.size() > 0) {
            Decimal bHours = (Decimal)groupedResults[0].get('billable');
            Decimal nbHours = (Decimal)groupedResults[0].get('nonBillable');
            
            // Null-safe addition
            totalHours = (bHours != null ? bHours : 0) + (nbHours != null ? nbHours : 0);
        }
        
        Decimal requiredLogHours;
        
        // Decide required log hours based on WORKED hours
        if (workedHours > 0 && workedHours <= 4) {
            requiredLogHours = 4;
        } else {
            requiredLogHours = 8;
        }
        
        if (totalHours < requiredLogHours) {
            throw new AuraHandledException(
                'You worked ' + workedHours + ' hours on ' + checkDate.format() +
                '. Please log at least ' + requiredLogHours +
                ' hours (currently logged: ' + totalHours + ').'
            );
        }
        
        
        // Validation check
        /*  if (totalHours < 8) {
throw new AuraHandledException(
'Total logged hours is ' + totalHours +
' for ' + checkDate.format() +
'. Minimum 8 hours required.'
);

} */
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Account> getAvailableAccounts() {
        try {
            Id userId = UserInfo.getUserId();
            Set<Id> accountIds = new Set<Id>();
            User currentUser = [SELECT Contact.AccountId FROM User WHERE Id = :userId LIMIT 1];
            if (currentUser.Contact?.AccountId != null) {
                accountIds.add(currentUser.Contact.AccountId);
            }
            for (AggregateResult agg : [
                SELECT Account__c 
                FROM Work_Session__c 
                WHERE User__c = :userId AND Account__c != NULL 
                GROUP BY Account__c
            ]) {
                accountIds.add((Id)agg.get('Account__c'));
            }
            if (accountIds.isEmpty()) {
                return new List<Account>();
            }
            return [
                SELECT Id, Name 
                FROM Account 
                WHERE Id IN :accountIds
                ORDER BY Name
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving accounts: ' + e.getMessage());
        }
    }
    
    private static void createPhotoAttachment(Id sessionId, String photoBase64, String photoType) {
        try {
            String fileName = photoType + '_Photo_' + DateTime.now().format('yyyy-MM-dd_HH-mm-ss') + '.jpg';
            ContentVersion cv = new ContentVersion(
                Title = fileName,
                PathOnClient = fileName,
                VersionData = EncodingUtil.base64Decode(photoBase64)
            );
            insert cv;
            Id docId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id].ContentDocumentId;
            ContentDocumentLink cdl = new ContentDocumentLink(
                ContentDocumentId = docId,
                LinkedEntityId = sessionId,
                ShareType = 'V'
            );
            insert cdl;
        } catch (Exception e) {
            System.debug('Error creating photo attachment: ' + e.getMessage());
        }
    }
    
    private static Long ipToLong(String ipAddress) {
        List<String> parts = ipAddress.split('\\.');
        if (parts.size() != 4) {
            return -1; 
        }
        
        Long ipLong = 0;
        try {
            for (String part : parts) {
                ipLong = ipLong << 8; 
                ipLong += Long.valueOf(part);
            }
            return ipLong;
        } catch (Exception e) {
            return -1; 
        }
    }
    
    private static Boolean isIpInRange(String ipAddress, String cidr) {
        if (String.isBlank(ipAddress) || String.isBlank(cidr)) {
            return false;
        }
        
        try {
            List<String> cidrParts = cidr.split('/');
            if (cidrParts.size() != 2) {
                return false; 
            }
            
            Long ipLong = ipToLong(ipAddress);
            Long rangeIpLong = ipToLong(cidrParts[0]);
            Integer prefixLength = Integer.valueOf(cidrParts[1]);
            
            if (ipLong == -1 || rangeIpLong == -1) {
                return false;
            }
            
            Long subnetMask = -1L << (32 - prefixLength);
            
            return (ipLong & subnetMask) == (rangeIpLong & subnetMask);
            
        } catch (Exception e) {
            System.debug('Error in IP/CIDR comparison: ' + e.getMessage());
            return false;
        }
    }
    
    private static void validateIpUsingClientIp(String clientIp) {
        if (String.isBlank(clientIp)) {
            throw new AuraHandledException('Unable to detect your device IP. Try again.');
        }
        
        String allowed = Label.Allowed_IPs;
        system.debug('allowe ' + allowed);
        if (String.isBlank(allowed)) {
            throw new AuraHandledException('No allowed IPs configured. Contact admin.');
        }
        
        Set<String> allowedSet = new Set<String>();
        for (String s : allowed.split(',')) {
            allowedSet.add(s.trim());
        }
        
        System.debug('Client IP: ' + clientIp + ' Allowed: ' + allowedSet);
        
        if (!allowedSet.contains(clientIp)) {
            throw new AuraHandledException('Access Denied: Your IP (' + clientIp + ') is not allowed.');
        }
    }  
    
    @AuraEnabled(cacheable=true)
    public static Decimal getTodaySessionHours() {
        try {
            Decimal total = 0.0;
            Date today = Date.today();
            List<Work_Session__c> sessions = [
                SELECT Id, Duration_Hours__c, Status__c, Check_In__c
                FROM Work_Session__c
                WHERE CreatedById = :UserInfo.getUserId()
                AND DAY_ONLY(CreatedDate) = :today
            ];
            for (Work_Session__c ws : sessions) {
                if (ws.Status__c == 'Checked Out') {
                    if (ws.Duration_Hours__c != null) {
                        total += ws.Duration_Hours__c;
                    }
                } else if (ws.Status__c == 'Checked In' && ws.Check_In__c != null) {
                    Long ms = System.now().getTime() - ws.Check_In__c.getTime();
                    Decimal hours = ms / (1000.0 * 60.0 * 60.0);
                    total += hours;
                }
            }
            return total.setScale(4);
        } catch (Exception e) {
            return 0.0;
        }
    }
}