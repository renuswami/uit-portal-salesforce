import { LightningElement, track } from 'lwc';
import getUpcomingHolidays from '@salesforce/apex/LeaveSummaryController.getUpcomingHolidays';

export default class HolidaySummaryComponent extends LightningElement {
    @track upcomingHolidays = [];
    @track loading = true;
    @track error = null;

    // Add this getter
    get showMainContent() {
        return !this.loading && !this.error;
    }

    // Rest of your existing methods remain the same...
    connectedCallback() {
        this.loadHolidayData();
    }

    async loadHolidayData() {
        try {
            this.loading = true;
            this.error = null;
            
            console.log('=== Loading holiday data ===');
            
            const holidayResult = await getUpcomingHolidays().catch(error => {
                console.error('Error in getUpcomingHolidays:', error);
                throw error;
            });
            
            if (Array.isArray(holidayResult)) {
                this.upcomingHolidays = holidayResult;
                console.log('✅ Holidays loaded:', this.upcomingHolidays.length, 'items');
            } else {
                console.error('❌ Holiday result is not an array:', typeof holidayResult);
                this.upcomingHolidays = [];
            }
            
        } catch (error) {
            console.error('💥 Error loading holiday data:', error);
            this.error = this.extractErrorMessage(error);
        } finally {
            this.loading = false;
            console.log('=== Holiday data load completed ===');
        }
    }

    extractErrorMessage(error) {
        if (error && error.body && error.body.message) {
            return error.body.message;
        } else if (error && error.message) {
            return error.message;
        } else if (typeof error === 'string') {
            return error;
        }
        return 'An unknown error occurred';
    }

    get hasHolidays() {
        return Array.isArray(this.upcomingHolidays) && this.upcomingHolidays.length > 0;
    }

    get hasNoUpcomingHolidays() {
        return !this.hasHolidays && !this.loading && !this.error;
    }

    get errorMessage() {
        return this.error;
    }

    handleRetry() {
        this.loadHolidayData();
    }
}