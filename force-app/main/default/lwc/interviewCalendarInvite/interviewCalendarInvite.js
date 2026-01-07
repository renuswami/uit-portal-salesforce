import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import getAvailableTemplates from '@salesforce/apex/EmailTemplateService.getAvailableTemplates';
import renderTemplate from '@salesforce/apex/EmailTemplateService.renderTemplate';
import sendInvite from '@salesforce/apex/iCalendarGenerator.sendInvite';
import CANDIDATE_EMAIL_FIELD from '@salesforce/schema/Candidate__c.Email__c';

export default class InterviewInviteManager extends LightningElement {
    @api recordId; 
    @track emailPreview = '';
    @track location = '';
    @track templateOptions = [];
    @track startDateTime = '';
    @track endDateTime = '';
    
    selectedTemplateId;
    candidateEmail;

    @wire(getRecord, { recordId: '$recordId', fields: [CANDIDATE_EMAIL_FIELD] })
    wiredCandidate({ error, data }) {
        if (data) this.candidateEmail = getFieldValue(data, CANDIDATE_EMAIL_FIELD);
    }

    @wire(getAvailableTemplates)
    wiredTemplates({ error, data }) {
        if (data) this.templateOptions = data;
    }

    handleTemplateChange(event) {
        this.selectedTemplateId = event.detail.value;
        this.fetchPreview();
    }

    handleBodyChange(event) { this.emailPreview = event.target.value; }
    handleStartChange(event) { this.startDateTime = event.target.value; }
    handleEndChange(event) { this.endDateTime = event.target.value; }

    async fetchPreview() {
        try {
            this.emailPreview = await renderTemplate({ 
                templateId: this.selectedTemplateId, 
                candidateId: this.recordId 
            });
        } catch (error) { console.error('Preview Error:', error); }
    }

    handleGenerateMeeting() {
        // We use the /new endpoint. 
        // When clicked, Google creates a unique room for the user.
        this.location = `https://meet.google.com/new`;
        
        const linkHtml = `<p><br/><strong>Join Google Meet:</strong> <a href="${this.location}" target="_blank">Click here to join meeting</a></p>`;
        
        if (!this.emailPreview.includes('meet.google.com')) {
            this.emailPreview += linkHtml;
        }
    }

    get isButtonDisabled() {
        return !this.emailPreview || !this.startDateTime || !this.endDateTime || !this.location;
    }

    async sendInvite() {
        try {
            await sendInvite({ 
                subject: 'Interview Invitation',
                startStr: this.startDateTime, 
                endStr: this.endDateTime,     
                location: this.location,
                recipientEmail: this.candidateEmail,
                candidateId: String(this.recordId),
                finalEmailBody: this.emailPreview
            }); 

            this.showToast('Success', 'Invite sent successfully!', 'success');
        } catch (error) {
            this.showToast('Error', error.body.message, 'error');
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}