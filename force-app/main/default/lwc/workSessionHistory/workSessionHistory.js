import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getMySessions from '@salesforce/apex/WorkSessionController.getMySessions';

export default class WorkSessionHistory extends LightningElement {
    @track sessions = [];
    @track error;
    wiredSessionsResult;

    @wire(getMySessions)
    wiredSessions(result) {
        this.wiredSessionsResult = result;
        if (result.data) {
            this.sessions = result.data.map(session => ({
                ...session,
                formattedCheckIn: this.formatDateTime(session.Check_In__c),
                formattedCheckOut: this.formatDateTime(session.Check_Out__c),
                formattedDuration: this.formatDuration(session.Duration_Hours__c),
                statusClass: this.getStatusClass(session.Status__c)
            }));
            this.error = undefined;
            console.log('Work sessions loaded:', this.sessions.length);
        } else if (result.error) {
            this.error = result.error;
            this.sessions = [];
            console.error('Error loading sessions:', this.error);
        }
    }

    get hasError() {
        return this.error !== undefined;
    }

    get hasSessions() {
        return this.sessions && this.sessions.length > 0;
    }

    get noSessionsMessage() {
        return 'No work sessions found. Start by checking in!';
    }

    async refreshSessions() {
        try {
            await refreshApex(this.wiredSessionsResult);
        } catch (error) {
            console.error('Error refreshing sessions:', error);
        }
    }

    formatDateTime(dateTimeValue) {
        if (!dateTimeValue) return '-';
        return new Date(dateTimeValue).toLocaleString();
    }

    formatDuration(hours) {
        if (!hours) return '-';
        const wholeHours = Math.floor(hours);
        const minutes = Math.round((hours - wholeHours) * 60);
        return `${wholeHours}h ${minutes}m`;
    }

    getStatusClass(status) {
        return status === 'Checked In' ? 'status-active' : 'status-completed';
    }
}