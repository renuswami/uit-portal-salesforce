public class InterviewHandler {
    
    public static void LatestInterviewOnCandidate(List<Interview__c> InterList){
        Set<Id> CondidateID = new Set<Id>();
        for(Interview__c Interview:InterList){
            CondidateID.add(Interview.Candidate__c);
        }
        List<Interview__c> AllInterviewList = [Select Id, Scheduled_Date_and_Time__c, Candidate__c, Stage__c, Status__c, 
                                            Interviewer__c, Interviewer_Feedback__c from Interview__c 
                                            where Candidate__c IN:CondidateID 
                                            ORDER BY Candidate__c, Scheduled_Date_and_Time__c DESC];
        //Map<CandidateId, Latest_Interview_Record>
        Map<Id, Interview__c> latestInterviewByCandidateId = new Map<Id, Interview__c>();
        for (Interview__c interview : AllInterviewList) {
            //First CandidateId will be Latest 'OrderByDesc'
            if (!latestInterviewByCandidateId.containsKey(interview.Candidate__c)) {
                latestInterviewByCandidateId.put(interview.Candidate__c, interview);
            }
        }
        
        List<Candidate__c> UpdateCandidates= new List<Candidate__c>();
        for (Id candId : latestInterviewByCandidateId.keySet()) {
            Interview__c latestInterview = latestInterviewByCandidateId.get(candId);
            Candidate__c candidate = new Candidate__c(Id = candId);
            candidate.Interview_Stage__c = latestInterview.Stage__c;
            candidate.Interview_Status__c = latestInterview.Status__c;
            candidate.Interviewer__c = latestInterview.Interviewer__c;
            candidate.Interviewer_s_Feedback__c = latestInterview.Interviewer_Feedback__c;
            
            UpdateCandidates.add(candidate);
        }
        
        Update UpdateCandidates;
        
    }

}