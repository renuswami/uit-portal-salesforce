import { LightningElement, wire, track } from 'lwc';

import getAccountId from '@salesforce/apex/CheckIncheckOutHandler.getAccountId';
import getWorkSession from '@salesforce/apex/CheckIncheckOutHandler.getWorkSession';
export default class CheckIncheckOut extends LightningElement {


    records = [
        { day: 'Sun', date: '12', hours: '00:00', isWeekend: true },
        { day: 'Mon', date: '13', hours: '23:06' },
        { day: 'Tue', date: '14', hours: '09:04' },
        { day: 'Wed', date: '15', hours: '08:46', isHalfDay: true },
        { day: 'Thu', date: '16', hours: '00:00', isAbsent: true },
        { day: 'Fri', date: '17', hours: '00:00', isAbsent: true },
        { day: 'Sat', date: '18', hours: '00:00', isWeekend: true }
    ];

    days = [
        { 'Sun' : 0} ,
        { 'Mon' : 1}  , 
        { 'Tue' : 2}  , 
        { 'Wed' : 3}  , 
        { 'Thu' : 4}  , 
        { 'Fri' : 5}  , 
        { 'Sat' : 6}    
    ]

    init() {

        let date = new Date(Date.now()).toString().split(' ');


        let i  =  date[2] - days[date[0]];

        let flag = false;

        this.records = this.records.map( ele => {
            if(flag){

            } else if(ele.day == date[0]){
                flag = true;
            }
            else if(ele.day == 'Fri'){

            }
            else{

                return { day: 'Sun', date : i , hours : '00:00', isWeekend : true }
            }
            i++;
        })
    }


}