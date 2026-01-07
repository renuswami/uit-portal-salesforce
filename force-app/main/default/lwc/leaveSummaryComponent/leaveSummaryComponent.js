import { LightningElement, track } from 'lwc';
import getLeaveSummary from '@salesforce/apex/LeaveSummaryController.getLeaveSummary';

export default class LeaveSummaryComponent extends LightningElement {

    

    @track leaveData = {};
    @track loading = true;
    @track error = null;

    connectedCallback() {
        this.loadLeaveData();
    }

    async loadLeaveData() {
        try {
            this.loading = true;
            this.error = null;
            
            console.log('=== Loading leave data ===');
            
            const leaveResult = await getLeaveSummary().catch(error => {
                console.error('Error in getLeaveSummary:', error);
                throw error;
            });
            
            if (leaveResult) {
                this.leaveData = leaveResult;
                console.log('✅ Leave data loaded successfully');
            }
            
        } catch (error) {
            console.error('💥 Error loading leave data:', error);
            this.error = this.extractErrorMessage(error);
        } finally {
            this.loading = false;
            console.log('=== Leave data load completed ===');
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

    // Getters for template
    get casualLeave() {
        return this.leaveData.casualLeave || { available: 0, booked: 0 };
    }

    get sickLeave() {
        return this.leaveData.sickLeave || { available: 0, booked: 0 };
    }

    get totalLeavesBooked() {
        return this.leaveData.totalLeavesBooked || 0;
    }

    get totalAbsent() {
        return this.leaveData.totalAbsent || 0;
    }

    get hasData() {
        return !this.loading && !this.error && Object.keys(this.leaveData).length > 0;
    }

    get errorMessage() {
        return this.error;
    }

    handleRetry() {
        this.loadLeaveData();
    }
}