import { LightningElement, track } from 'lwc';
import getRegularizationCounts from '@salesforce/apex/AttendanceAndRegularizeController.getRegularizationCounts';

export default class TestApexCall extends LightningElement {
    @track counts = { totalApplied: 0, approved: 0, pending: 0, rejected: 0 };
    @track loading = false;
    @track error;

    handleClick() {
        this.loading = true;
        this.error = undefined;
        
        // Call the method directly
        getRegularizationCounts({ month: 11, year: 2025 })
            .then(result => {
                this.counts = {
                    totalApplied: result.totalApplied ?? 0,
                    approved: result.approved ?? 0,
                    pending: result.pending ?? 0,
                    rejected: result.rejected ?? 0
                };
                this.loading = false;
            })
            .catch(error => {
                this.error = error;
                this.loading = false;
                console.error('Error:', error);
            });
    }
}