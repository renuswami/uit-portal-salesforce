import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';
import getExistingDocuments from '@salesforce/apex/DocumentChecklistController.getExistingDocuments';
import createDocumentRecord from '@salesforce/apex/DocumentChecklistController.createDocumentRecord';
import deleteDocument from '@salesforce/apex/DocumentChecklistController.deleteDocument';

const REQUIRED_DOCS = [
    { label: '10th Marksheet', value: '10th Marksheet', isRequired: false },
    { label: '12th Marksheet', value: '12th Marksheet', isRequired: false },
    { label: 'Graduate Marksheet', value: 'Graduate Marksheet', isRequired: false },
    { label: 'Masters Marksheet', value: 'Masters Marksheet', isRequired: false },
    { label: 'Aadhar Card', value: 'Aadhar Card', isRequired: false },
    { label: 'PAN Card', value: 'PAN Card', isRequired: false },
    { label: 'Experience/Relieving Letter', value: 'Experience/Relieving Letter', isRequired: false },
    { label: 'Other Attachments', value: 'Other Attachments', isRequired: false },

];

export default class DocumentInputList extends NavigationMixin(LightningElement) {
    @api recordId;
    @api objectApiName = 'Account';

    @track documents = [];
    @track isLoading = true;
    wiredDocumentsResult;

    connectedCallback() {
        this.initializeChecklist();
    }

    initializeChecklist() {
        this.documents = REQUIRED_DOCS.map(doc => ({
            ...doc,
            id: doc.value,
            name: '',
            isUploaded: false,
            isMissing: true,
            key: doc.value
        }));
    }

    @wire(getExistingDocuments, { recordId: '$recordId' })
    wiredDocuments(result) {
        this.wiredDocumentsResult = result;
        const { error, data } = result;
        this.isLoading = false;

        if (data) {
            this.processDocuments(data);
        } else if (error) {
            console.error('Error fetching documents:', error);
            this.handleError(error, 'Error loading existing documents');
            if (this.documents.length === 0) this.initializeChecklist();
        } else {
             this.initializeChecklist();
        }
    }

    processDocuments(existingDocs) {
        const docMap = new Map();

        if (existingDocs && existingDocs.length > 0) {
            existingDocs.forEach(doc => {
                docMap.set(doc.docType, {
                    id: doc.id,
                    name: doc.name,
                    isUploaded: true,
                    contentDocumentId: doc.contentDocumentId
                });
            });
        }

        this.documents = REQUIRED_DOCS.map(req => {
            const existing = docMap.get(req.value);
            return {
                ...req,
                key: req.value,
                ...(existing || {}),
                isUploaded: !!existing,
                isMissing: !existing
            };
        });
    }

    handleUploadFinished(event) {
        const uploadedFiles = event.detail.files;
        if (!uploadedFiles || uploadedFiles.length === 0) return;

        const documentType = event.target.dataset.doctype;
        const contentVersionId = uploadedFiles[0].contentVersionId;
        const fileName = uploadedFiles[0].name;

        this.isLoading = true;

        createDocumentRecord({
            accountId: this.recordId,
            documentType: documentType,
            contentVersionId: contentVersionId
        })
        .then(() => {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: `${fileName} uploaded successfully!`,
                    variant: 'success',
                }),
            );
            return refreshApex(this.wiredDocumentsResult);
        })
        .catch(error => {
            this.handleError(error, `Error linking ${documentType}`);
            this.isLoading = false;
        });
    }

    navigateToDocument(event) {
        event.preventDefault();
        const fileId = event.currentTarget.dataset.fileid;

        if (fileId) {
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: fileId,
                    objectApiName: 'ContentDocument',
                    actionName: 'view'
                }
            });
        } else {
            const docId = event.currentTarget.dataset.id;
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: docId,
                    objectApiName: 'Document__c',
                    actionName: 'view'
                }
            });
        }
    }

    handlePreview(event) {
        this.navigateToDocument(event);
    }

    handleDelete(event) {
        const docId = event.target.dataset.docid;
        // eslint-disable-next-line no-alert
        if (!confirm('Are you sure you want to delete this document? This cannot be undone.')) {
            return;
        }

        this.isLoading = true;

        deleteDocument({ docRecordId: docId })
        .then(() => {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Deleted',
                    message: 'Document deleted successfully',
                    variant: 'success',
                }),
            );
            return refreshApex(this.wiredDocumentsResult);
        })
        .catch(error => {
            this.handleError(error, 'Error deleting document');
            this.isLoading = false;
        });
    }

    handleError(error, title) {
        let message = 'An unknown error occurred.';
        if (error && error.body && error.body.message) {
            message = error.body.message;
        } else if (error && error.message) {
            message = error.message;
        }

        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: 'error',
            }),
        );
    }
}



/*navigateToDocument(event) {
        event.preventDefault();
        const fileId = event.currentTarget.dataset.fileid;
        if (fileId) {
            this[NavigationMixin.Navigate]({
                type: 'standard__namedPage',
                attributes: {
                    pageName: 'filePreview',
                },
                state: {
                    selectedRecordId: fileId
                }
            });
        } else {
            const docId = event.currentTarget.dataset.id;
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: docId,
                    objectApiName: 'Document__c',
                    actionName: 'view'
                }
            });
        }
    }
navigateToDocument(event) {
        event.preventDefault();
        const fileId = event.currentTarget.dataset.fileid;

        if (fileId) {
            // THIS IS THE FIX: 
            // Navigate to the 'ContentDocument' record page.
            // This opens the standard Salesforce File Viewer.
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: fileId,
                    objectApiName: 'ContentDocument',
                    actionName: 'view'
                }
            });
        } else {
            // Keep your existing logic for empty rows
            const docId = event.currentTarget.dataset.id;
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: docId,
                    objectApiName: 'Document__c',
                    actionName: 'view'
                }
            });
        }
    }*/