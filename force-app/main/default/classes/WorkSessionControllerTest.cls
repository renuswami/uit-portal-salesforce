@isTest
public class WorkSessionControllerTest {
    
    @TestSetup
    static void setupTestData() {
        // Create test account
        Account testAccount = new Account(Name = 'Test Account');
        insert testAccount;
        
        // Create test user (simulating portal user)
        Profile portalProfile = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        User testUser = new User(
            FirstName = 'Test',
            LastName = 'User',
            Email = 'testuser@example.com',
            Username = 'testuser@example.com.test',
            Alias = 'tuser',
            TimeZoneSidKey = 'America/New_York',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US',
            ProfileId = portalProfile.Id
        );
        insert testUser;
    }
    
    @isTest
    static void testGetMySessions() {
        User testUser = [SELECT Id FROM User WHERE Username = 'testuser@example.com.test' LIMIT 1];
        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account' LIMIT 1];
        
        System.runAs(testUser) {
            // Create test work session
            Work_Session__c session = new Work_Session__c(
                User__c = testUser.Id,
                Account__c = testAccount.Id,
                Check_In__c = System.now().addHours(-2),
                Check_Out__c = System.now(),
                Status__c = 'Checked Out'
            );
            insert session;
            
            Test.startTest();
            List<Work_Session__c> sessions = WorkSessionController.getMySessions();
            Test.stopTest();
            
            System.assertEquals(1, sessions.size(), 'Should return one session');
            System.assertEquals(testUser.Id, sessions[0].User__c, 'Session should belong to test user');
        }
    }
    
    @isTest
    static void testGetCurrentSession() {
        User testUser = [SELECT Id FROM User WHERE Username = 'testuser@example.com.test' LIMIT 1];
        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account' LIMIT 1];
        
        System.runAs(testUser) {
            // Create active session
            Work_Session__c session = new Work_Session__c(
                User__c = testUser.Id,
                Account__c = testAccount.Id,
                Check_In__c = System.now(),
                Status__c = 'Checked In'
            );
            insert session;
            
            Test.startTest();
            Work_Session__c currentSession = WorkSessionController.getCurrentSession();
            Test.stopTest();
            
            System.assertNotEquals(null, currentSession, 'Should return current session');
            System.assertEquals('Checked In', currentSession.Status__c, 'Session should be checked in');
        }
    }
    
    @isTest
    static void testCheckIn() {
        User testUser = [SELECT Id FROM User WHERE Username = 'testuser@example.com.test' LIMIT 1];
        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account' LIMIT 1];
        
        System.runAs(testUser) {
            Test.startTest();
            Work_Session__c session = WorkSessionController.checkIn(testAccount.Id, null);
            Test.stopTest();
            
            System.assertNotEquals(null, session, 'Should return created session');
            System.assertEquals('Checked In', session.Status__c, 'Session should be checked in');
            System.assertEquals(testUser.Id, session.User__c, 'Session should belong to test user');
        }
    }
    
    @isTest
    static void testCheckInAlreadyCheckedIn() {
        User testUser = [SELECT Id FROM User WHERE Username = 'testuser@example.com.test' LIMIT 1];
        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account' LIMIT 1];
        
        System.runAs(testUser) {
            // Create existing checked in session
            Work_Session__c existingSession = new Work_Session__c(
                User__c = testUser.Id,
                Account__c = testAccount.Id,
                Check_In__c = System.now(),
                Status__c = 'Checked In'
            );
            insert existingSession;
            
            Test.startTest();
            try {
                WorkSessionController.checkIn(testAccount.Id, null);
                System.assert(false, 'Should have thrown exception');
            } catch (AuraHandledException e) {
                System.assert(e.getMessage().contains('already checked in'), 'Should indicate user is already checked in');
            }
            Test.stopTest();
        }
    }
    
    @isTest
    static void testCheckOut() {
        User testUser = [SELECT Id FROM User WHERE Username = 'testuser@example.com.test' LIMIT 1];
        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account' LIMIT 1];
        
        System.runAs(testUser) {
            // Create checked in session
            Work_Session__c session = new Work_Session__c(
                User__c = testUser.Id,
                Account__c = testAccount.Id,
                Check_In__c = System.now().addHours(-1),
                Status__c = 'Checked In'
            );
            insert session;
            
            Test.startTest();
            Work_Session__c updatedSession = WorkSessionController.checkOut(null);
            Test.stopTest();
            
            System.assertEquals('Checked Out', updatedSession.Status__c, 'Session should be checked out');
            System.assertNotEquals(null, updatedSession.Check_Out__c, 'Check out time should be set');
        }
    }
    
    @isTest
    static void testCheckOutNoActiveSession() {
        User testUser = [SELECT Id FROM User WHERE Username = 'testuser@example.com.test' LIMIT 1];
        
        System.runAs(testUser) {
            Test.startTest();
            try {
                WorkSessionController.checkOut(null);
                System.assert(false, 'Should have thrown exception');
            } catch (AuraHandledException e) {
                System.assert(e.getMessage().contains('No active session'), 'Should indicate no active session');
            }
            Test.stopTest();
        }
    }
    
    @isTest
    static void testGetTodayTotalHours() {
        User testUser = [SELECT Id FROM User WHERE Username = 'testuser@example.com.test' LIMIT 1];
        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account' LIMIT 1];
        
        System.runAs(testUser) {
            // Create completed session for today
            Work_Session__c session = new Work_Session__c(
                User__c = testUser.Id,
                Account__c = testAccount.Id,
                Check_In__c = System.now().addHours(-2),
                Check_Out__c = System.now(),
                Status__c = 'Checked Out'
            );
            insert session;
            
            Test.startTest();
            Decimal totalHours = WorkSessionController.getTodayTotalHours();
            Test.stopTest();
            
            System.assert(totalHours > 0, 'Should return positive hours');
        }
    }
    
    @isTest
    static void testGetAvailableAccounts() {
        User testUser = [SELECT Id FROM User WHERE Username = 'testuser@example.com.test' LIMIT 1];
        
        System.runAs(testUser) {
            Test.startTest();
            List<Account> accounts = WorkSessionController.getAvailableAccounts();
            Test.stopTest();
            
            // This test may return empty list for standard users, which is expected
            System.assert(accounts != null, 'Should return a list (may be empty)');
        }
    }
}