import { LightningElement, track, wire } from 'lwc';
import getTimeLogSummaries from '@salesforce/apex/TimeLogSummaryController.getTimeLogSummaries';

export default class TimeLogSummary extends LightningElement {
    @track summaries = [];
    @track periodType = 'Month'; // Month or Week
    @track selectedMonth = ''; // YYYY-MM
    @track selectedWeek = 'This Week'; // This Week, Last Week
    @track isLoading = true;

    startDate;
    endDate;

    periodOptions = [
        { label: 'Month', value: 'Month' },
        { label: 'Week', value: 'Week' }
    ];

    weekOptions = [
        { label: 'This Week', value: 'This Week' },
        { label: 'Last Week', value: 'Last Week' }
    ];

    connectedCallback() {
        this.setDefaultMonth();
        this.calculateDateRange();
    }

    setDefaultMonth() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        this.selectedMonth = `${year}-${month}`;
    }

    handlePeriodChange(event) {
        this.periodType = event.detail.value;
        this.calculateDateRange();
    }

    handleMonthChange(event) {
        this.selectedMonth = event.target.value;
        this.calculateDateRange();
    }

    handleWeekChange(event) {
        this.selectedWeek = event.detail.value;
        this.calculateDateRange();
    }

    calculateDateRange() {
        if (this.periodType === 'Month') {
            if (this.selectedMonth) {
                const [year, month] = this.selectedMonth.split('-');
                // Create date object (Month is 0-indexed in JS Date)
                const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                
                // First day of month
                // Handle timezone offset issues by using local date string construction or careful manipulation
                // Simple approach: setDate(1) and setMonth/Year
                
                const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
                const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                
                // Adjust for timezone to ensure we send YYYY-MM-DD correctly
                this.startDate = this.formatDate(firstDay);
                this.endDate = this.formatDate(lastDay);
            }
        } else {
            const today = new Date();
            const currentDay = today.getDay(); // 0 is Sunday
            // Assume Monday is start of week
            const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
            const thisMonday = new Date(today);
            thisMonday.setDate(today.getDate() + distanceToMonday);
            
            if (this.selectedWeek === 'This Week') {
                this.startDate = this.formatDate(thisMonday);
                const thisSunday = new Date(thisMonday);
                thisSunday.setDate(thisMonday.getDate() + 6);
                this.endDate = this.formatDate(thisSunday);
            } else {
                const lastMonday = new Date(thisMonday);
                lastMonday.setDate(thisMonday.getDate() - 7);
                this.startDate = this.formatDate(lastMonday);
                const lastSunday = new Date(lastMonday);
                lastSunday.setDate(lastMonday.getDate() + 6);
                this.endDate = this.formatDate(lastSunday);
            }
        }
    }
    
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    @wire(getTimeLogSummaries, { startDate: '$startDate', endDate: '$endDate' })
    wiredSummaries({ error, data }) {
        this.isLoading = true; // Set loading true when wire triggers (optional, might flicker)
        if (data) {
            this.summaries = data;
            this.isLoading = false;
        } else if (error) {
            console.error('Error fetching summaries:', error);
            this.summaries = [];
            this.isLoading = false;
        }
    }
    
    get isMonth() {
        return this.periodType === 'Month';
    }
}
