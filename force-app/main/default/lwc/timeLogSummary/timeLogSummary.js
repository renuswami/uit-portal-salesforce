import { LightningElement, track, wire } from 'lwc';
import getTimeLogSummaries from '@salesforce/apex/TimeLogSummaryController.getTimeLogSummaries';

export default class TimeLogSummary extends LightningElement {
    @track summaries = [];
    @track selectedMonth = ''; // YYYY-MM
    @track selectedWeek = ''; // This Week, Last Week
    @track isLoading = true;
    @track logFilter = 'All'; // All, Logged Hours, Approved Logged Hours
    
    // Explicit Start/End dates visible in the UI
    @track startDate = '';
    @track endDate = '';
    @track cacheBuster = Math.random();

    monthOptions = [];

    weekOptions = [
        { label: 'This Week', value: 'This Week' },
        { label: 'Last Week', value: 'Last Week' }
    ];

    filterOptions = [
        { label: 'All', value: 'All' },
        { label: 'Logged Hours', value: 'Logged Hours' },
        { label: 'Approved Logged Hours', value: 'Approved Logged Hours' }
    ];

    connectedCallback() {
        this.generateMonthOptions();
        this.setDefaultMonth();
    }

    generateMonthOptions() {
        const today = new Date();
        const currentYear = today.getFullYear();
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        this.monthOptions = months.map((name, index) => {
            const monthNum = String(index + 1).padStart(2, '0');
            return {
                label: `${name} ${currentYear}`,
                value: `${currentYear}-${monthNum}`
            };
        });
    }

    setDefaultMonth() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        this.selectedMonth = `${year}-${month}`;
        this.updateDatesFromMonth();
    }

    handleMonthChange(event) {
        this.selectedMonth = event.detail.value;
        this.selectedWeek = ''; // Clear week selection
        this.updateDatesFromMonth();
    }

    handleWeekChange(event) {
        this.selectedWeek = event.detail.value;
        this.selectedMonth = ''; // Clear month selection
        this.updateDatesFromWeek();
    }

    handleStartDateChange(event) {
        this.startDate = event.target.value;
        this.clearDropdowns();
    }

    handleEndDateChange(event) {
        this.endDate = event.target.value;
        this.clearDropdowns();
    }

    clearDropdowns() {
        this.selectedMonth = '';
        this.selectedWeek = '';
    }

    handleFilterChange(event) {
        this.logFilter = event.detail.value;
    }

    updateDatesFromMonth() {
        if (this.selectedMonth) {
            const [year, month] = this.selectedMonth.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1, 1);
            
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            
            this.startDate = this.formatDate(firstDay);
            this.endDate = this.formatDate(lastDay);
        }
    }

    updateDatesFromWeek() {
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
        } else if (this.selectedWeek === 'Last Week') {
            const lastMonday = new Date(thisMonday);
            lastMonday.setDate(thisMonday.getDate() - 7);
            this.startDate = this.formatDate(lastMonday);
            const lastSunday = new Date(lastMonday);
            lastSunday.setDate(lastMonday.getDate() + 6);
            this.endDate = this.formatDate(lastSunday);
        }
    }
    
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    @wire(getTimeLogSummaries, { startDate: '$startDate', endDate: '$endDate', cacheBuster: '$cacheBuster' })
    wiredSummaries({ error, data }) {
        this.isLoading = true;
        if (data) {
            this.summaries = data.map(s => ({
                ...s,
                totalApprovedHours: s.totalApprovedHours !== undefined ? s.totalApprovedHours : 0
            }));
            this.isLoading = false;
        } else if (error) {
            console.error('Error fetching summaries:', error);
            this.summaries = [];
            this.isLoading = false;
        }
    }
    
    get showBillableBreakdown() {
        return this.logFilter === 'All' || this.logFilter === 'Logged Hours';
    }

    get showTotalHours() {
        return this.logFilter === 'All' || this.logFilter === 'Logged Hours' || this.logFilter === 'Approved Logged Hours';
    }

    get showApprovedRow() {
        return this.logFilter === 'All';
    }
    
    get isApprovedFilter() {
        return this.logFilter === 'Approved Logged Hours';
    }
}
