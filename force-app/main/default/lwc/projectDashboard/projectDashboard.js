import { LightningElement, wire } from 'lwc';
// CHANGE: Import the new method
import getAllProjectDashboardData from '@salesforce/apex/ProjectDashboardController.getAllProjectDashboardData';

export default class ProjectDashboard extends LightningElement {
    // REMOVED: @api recordId;
    
    dashboardData; // This will now be a list of projects
    error;
    errorMessage;
    isLoading = true;

    // CHANGE: Call the new method (no parameters)
    @wire(getAllProjectDashboardData)
    wiredDashboardData({ error, data }) {
        if (data) {
            this.dashboardData = data;
            this.error = undefined;
            this.isLoading = false;
        } else if (error) {
            this.error = error;
            this.errorMessage = this.reduceErrors(error).join(', ');
            this.dashboardData = undefined;
            this.isLoading = false;
        }
    }

    // NEW: Getter to check if we have any data to show
    get hasData() {
        return this.dashboardData && this.dashboardData.length > 0;
    }

    // Helper function to extract a user-friendly error message
    reduceErrors(errors) {
        if (!Array.isArray(errors)) {
            errors = [errors];
        }

        return (
            errors
                .filter((error) => !!error)
                .map((error) => {
                    if (Array.isArray(error.body)) {
                        return error.body.map((e) => e.message);
                    }
                    else if (error.body && typeof error.body.message === 'string') {
                        return error.body.message;
                    }
                    else if (typeof error.message === 'string') {
                        return error.message;
                    }
                    return 'An unknown error occurred';
                })
                .reduce((prev, curr) => prev.concat(curr), [])
                .filter((message) => !!message)
        );
    }
}