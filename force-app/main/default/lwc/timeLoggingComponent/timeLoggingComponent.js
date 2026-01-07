import { LightningElement, track, wire, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getProjects from '@salesforce/apex/TimeLoggingController.getProjects';
import getTasksByProject from '@salesforce/apex/TimeLoggingController.getTasksByProject';
import searchTasks from '@salesforce/apex/TimeLoggingController.searchTasks';
import createTimeLog from '@salesforce/apex/TimeLoggingController.createTimeLog';
import getRecentTimeLogs from '@salesforce/apex/TimeLoggingController.getRecentTimeLogs';

export default class TimeLoggingComponent extends LightningElement {
    @api title;
    // Form data properties
    @track selectedProjectId = '';
    @track selectedProject = null;
    @track selectedTask = null;
    @track taskSearchTerm = '';
    @track logDate = this.getTodayDate();
    @track hours = '';
    @track description = '';
    @track billable = false;

    // UI state properties
    @track projectOptions = [];
    @track filteredTasks = [];
    @track showTaskDropdown = false;
    @track showRecentLogs = false;
    @track recentTimeLogs = [];

    // Message properties
    @track showSuccessMessage = false;
    @track showErrorMessage = false;
    @track successMessage = '';
    @track errorMessage = '';

    // Computed properties for template
    get isProjectNotSelected() {
        return !this.selectedProjectId;
    }

    get isFormInvalid() {
        return !this.selectedProjectId || !this.selectedTask || !this.logDate || !this.hours || this.hours <= 0;
    }

    get noTasksFound() {
        return this.filteredTasks.length === 0 && this.taskSearchTerm.length > 0;
    }

    get formattedDueDate() {
        if (this.selectedTask && this.selectedTask.Due_Date__c) {
            return new Date(this.selectedTask.Due_Date__c).toLocaleDateString();
        }
        return 'No due date';
    }

    // Wire methods
    @wire(getProjects)
    wiredProjects({ error, data }) {
        if (data) {
            this.projectOptions = data.map(project => ({
                label: project.Name,
                value: project.Id,
                description: project.Description__c
            }));
        } else if (error) {
            this.showError('Error loading projects: ' + error.body.message);
        }
    }

    @wire(getRecentTimeLogs, { limitCount: 10 })
    wiredRecentLogs({ error, data }) {
        if (data) {
            this.recentTimeLogs = data.map(log => ({
                ...log,
                formattedDate: new Date(log.logDate).toLocaleDateString()
            }));
            this.showRecentLogs = this.recentTimeLogs.length > 0;
        } else if (error) {
            console.error('Error loading recent logs:', error);
        }
    }

    // Event handlers
    handleProjectChange(event) {
        this.selectedProjectId = event.detail.value;
        this.selectedProject = this.projectOptions.find(p => p.value === this.selectedProjectId);
        
        // Reset task selection
        this.selectedTask = null;
        this.taskSearchTerm = '';
        this.filteredTasks = [];
        this.showTaskDropdown = false;
        
        this.hideMessages();
    }

    async handleTaskSearch(event) {
        this.taskSearchTerm = event.detail.value;
        
        if (this.taskSearchTerm.length >= 2 && this.selectedProjectId) {
            try {
                const tasks = await searchTasks({ 
                    searchTerm: this.taskSearchTerm, 
                    projectId: this.selectedProjectId 
                });
                this.filteredTasks = tasks;
                this.showTaskDropdown = true;
            } catch (error) {
                this.showError('Error searching tasks: ' + error.body.message);
                this.filteredTasks = [];
                this.showTaskDropdown = false;
            }
        } else if (this.taskSearchTerm.length === 0) {
            // Load all tasks for the project when search is cleared
            try {
                const tasks = await getTasksByProject({ projectId: this.selectedProjectId });
                this.filteredTasks = tasks;
                this.showTaskDropdown = tasks.length > 0;
            } catch (error) {
                this.filteredTasks = [];
                this.showTaskDropdown = false;
            }
        } else {
            this.filteredTasks = [];
            this.showTaskDropdown = false;
        }
    }

    handleTaskSelect(event) {
        const taskId = event.currentTarget.dataset.taskId;
        this.selectedTask = this.filteredTasks.find(task => task.Id === taskId);
        this.taskSearchTerm = this.selectedTask.Name;
        this.showTaskDropdown = false;
        this.hideMessages();
    }

    handleDateChange(event) {
        this.logDate = event.detail.value;
        this.hideMessages();
    }

    handleHoursChange(event) {
        this.hours = event.detail.value;
        this.hideMessages();
    }

    handleDescriptionChange(event) {
        this.description = event.detail.value;
        this.hideMessages();
    }

    handleBillableChange(event) {
        this.billable = event.detail.checked;
        this.hideMessages();
    }

    handleQuickHour(event) {
        this.hours = event.target.dataset.hours;
        this.hideMessages();
    }

    async handleSubmit() {
        if (this.isFormInvalid) {
            this.showError('Please fill in all required fields.');
            return;
        }

        try {
            const timeLogData = {
                taskId: this.selectedTask.Id,
                hours: parseFloat(this.hours),
                logDate: this.logDate,
                description: this.description,
                billable: this.billable
            };

            const result = await createTimeLog({ timeLogData });
            this.showSuccess(result);
            this.clearForm();
            
            // Refresh recent logs
            return refreshApex(this.wiredRecentLogs);
            
        } catch (error) {
            this.showError('Error creating time log: ' + error.body.message);
        }
    }

    handleClear() {
        this.clearForm();
        this.hideMessages();
    }

    toggleRecentLogs() {
        this.showRecentLogs = !this.showRecentLogs;
    }

    // Utility methods
    clearForm() {
        this.selectedProjectId = '';
        this.selectedProject = null;
        this.selectedTask = null;
        this.taskSearchTerm = '';
        this.logDate = this.getTodayDate();
        this.hours = '';
        this.description = '';
        this.billable = false;
        this.filteredTasks = [];
        this.showTaskDropdown = false;
    }

    getTodayDate() {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }

    showSuccess(message) {
        this.successMessage = message;
        this.showSuccessMessage = true;
        this.showErrorMessage = false;
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
            this.hideMessages();
        }, 5000);

        // Also show toast notification
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: message,
                variant: 'success'
            })
        );
    }

    showError(message) {
        this.errorMessage = message;
        this.showErrorMessage = true;
        this.showSuccessMessage = false;
        
        // Auto-hide error message after 8 seconds
        setTimeout(() => {
            this.hideMessages();
        }, 8000);

        // Also show toast notification
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Error',
                message: message,
                variant: 'error'
            })
        );
    }

    hideMessages() {
        this.showSuccessMessage = false;
        this.showErrorMessage = false;
        this.successMessage = '';
        this.errorMessage = '';
    }

    // Handle clicks outside dropdown to close it
    connectedCallback() {
        this.template.addEventListener('click', this.handleDocumentClick.bind(this));
    }

    disconnectedCallback() {
        this.template.removeEventListener('click', this.handleDocumentClick.bind(this));
    }

    handleDocumentClick(event) {
        const taskDropdown = this.template.querySelector('.task-dropdown');
        const taskSearch = this.template.querySelector('.task-search');
        
        if (taskDropdown && taskSearch && 
            !taskDropdown.contains(event.target) && 
            !taskSearch.contains(event.target)) {
            this.showTaskDropdown = false;
        }
    }
}