import { LightningElement, track, wire } from 'lwc';
import getRegularizationCounts from '@salesforce/apex/AttendanceAndRegularizeController.getRegularizationCounts';
import getAttendanceStats from '@salesforce/apex/AttendanceAndRegularizeController.getAttendanceStats';

export default class AttendanceAndRegularize extends LightningElement {
    @track selectedMonth;
    @track selectedYear;
    @track attendanceData = {
        present: 0,
        absent: 0,
        halfDayPresent: 0,
        regularizationApplied: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        totalWorkingDays: 0,
        totalDays: 0
    };

    months = [
        { label: 'January', value: '1' },
        { label: 'February', value: '2' },
        { label: 'March', value: '3' },
        { label: 'April', value: '4' },
        { label: 'May', value: '5' },
        { label: 'June', value: '6' },
        { label: 'July', value: '7' },
        { label: 'August', value: '8' },
        { label: 'September', value: '9' },
        { label: 'October', value: '10' },
        { label: 'November', value: '11' },
        { label: 'December', value: '12' }
    ];

   connectedCallback() {
        console.log('connected callback');

        const today = new Date();
        this.selectedMonth = today.getMonth() + 1;   
        this.selectedYear = today.getFullYear();     

        console.log('selected month/year:', this.selectedMonth, this.selectedYear);

        this.loadAllStats();
        this.loadRegularizationCounts();
    }

    loadRegularizationCounts() {
        getRegularizationCounts({
            month: this.selectedMonth,
            year: this.selectedYear
        })
        .then((data) => {
            console.log('Apex data:', data);

            this.attendanceData = {
                ...this.attendanceData,
                regularizationApplied: data?.totalApplied ?? 0,
                approved: data?.approved ?? 0,
                pending: data?.pending ?? 0,
                rejected: data?.rejected ?? 0
            };
        })
        .catch((error) => {
            console.error('Error loading regularization counts:', error);
        });
    }

    handleMonthChange(event) {
        this.selectedMonth = parseInt(event.detail.value, 10);
        this.loadAllStats();
        this.loadRegularizationCounts();
    }

    handleYearChange(event) {
        this.selectedYear = parseInt(event.detail.value, 10);
        this.loadAllStats();
        this.loadRegularizationCounts();
    }

    loadAllStats() {
        if (!this.selectedMonth || !this.selectedYear) return;
        
        this.loadAttendanceStats();
    }

    loadAttendanceStats() {
        getAttendanceStats({
            month: this.selectedMonth,
            year: this.selectedYear
        })
        .then((data) => {
            this.attendanceData = {
                ...this.attendanceData,
                present: data?.present ?? 0,
                absent: data?.absent ?? 0,
                halfDayPresent: data?.halfDayPresent ?? 0
            };
        })
        .catch(error => {
            console.error('Error loading attendance stats:', error);
            this.attendanceData = {
                ...this.attendanceData,
                present: 0,
                absent: 0,
                halfDayPresent: 0
            };
        });
    }

    get totalWorkingDays() {
        const fullDays = (this.attendanceData.present || 0) + (this.attendanceData.absent || 0);
        const halfDays = (this.attendanceData.halfDayPresent || 0);
        return fullDays + (halfDays * 0.5);
    }

    get totalDays() {
    return new Date(this.selectedYear, this.selectedMonth + 1, 0).getDate();
    }   

get presentPercentage() {
    const present = (this.attendanceData.present || 0) + (this.attendanceData.halfDayPresent || 0) * 0.5;
    const workingDays = this.totalWorkingDays;

    if (workingDays === 0) return 0;
    return Math.round((present / workingDays) * 100);
}

get absentPercentage() {
    const absent = (this.attendanceData.absent || 0) + (this.attendanceData.halfDayPresent || 0) * 0.5;
    const workingDays = this.totalWorkingDays;

    if (workingDays === 0) return 0;
    return Math.round((absent / workingDays) * 100);
}


    get regularizationPercentage() {
        if (this.attendanceData.regularizationApplied === 0) return 0;
        return Math.round((this.attendanceData.approved / this.attendanceData.regularizationApplied) * 100);
    }
}