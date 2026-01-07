/**
* @File Name : CheckIncheckOutHandler.cls
* @Description :
* @Author :	Pawan Karki
* @Last Modified By :
* @Last Modified On : October 28, 2025
* @Modification Log :
*==============================================================================
* Ver | Date | Author | Modification
*==============================================================================
* 1.0 | October 28, 2025 |   | Initial Version
**/

public class CheckIncheckOutHandler {
	


	@AuraEnabled(cacheable=true)
	public static string getAccountId(){

		
		User userObject = [SELECT Personal_Account_Id__c , Profile.Name  from user where id = :UserInfo.getUserId()];
		Profile p = userObject.Profile;
		Boolean flag = p.Name == 'System Administrator'	 ? TRUE : FALSE;

		if(flag){
			return userObject.Personal_Account_Id__c;
		}		
		return null;
	}


	@AuraEnabled
	public static List<Map<Object,Object>> getWorkSession(String accountId){

		List<Map<Object,Object>> returnList = new List<Map<Object,Object>>();

		for(Work_Session__c workSessionObject : [SELECT  Check_In__c , Check_Out__c  from Work_Session__c  where Account__c  =:accountId LIMIT 7  ]){

			Map<Object,Object> mapForList = new Map<Object,Object>();

			mapForList.put('checkIn' , workSessionObject.Check_In__c);
			mapForList.put('checkOut' , workSessionObject.Check_Out__c);
			returnList.add(mapForList);
		}

		if(!returnList.isEmpty()){

			return returnList;
		}

		return null;
	}



	//@AuraEnabled
	public static List<Map<Object,Object>> initWorkSessions(Integer dateForSessions){

		List<Map<Object,Object>> returnList = new List<Map<Object,Object>>();

		Date currentDate = Date.today().addDays(- dateForSessions);

		for(Work_Session__c workSessionObject : [SELECT  Check_In__c , Check_Out__c  from Work_Session__c  where CreatedDate >= :currentDate  LIMIT 7  ]){

			Map<Object,Object> mapForList = new Map<Object,Object>();

			mapForList.put('checkIn' , workSessionObject.Check_In__c);
			mapForList.put('checkOut' , workSessionObject.Check_Out__c);
			returnList.add(mapForList);
		}


		system.debug(returnList);

		if(!returnList.isEmpty()){

			return returnList;
		}

		return null;

	}

}