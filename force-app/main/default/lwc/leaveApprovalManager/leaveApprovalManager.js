import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getPendingLeaves from '@salesforce/apex/LeaveApprovalController.getPendingLeaves';
import updateLeaveStatus from '@salesforce/apex/LeaveApprovalController.updateLeaveStatus';

export default class LeaveApprovalManager extends LightningElement {
    @track leaves = [];
    @track selectedIds = new Set();
    wiredLeavesResult;
    isLoading = false;

    @wire(getPendingLeaves)
    wiredLeaves(result) {
        this.wiredLeavesResult = result;
        const { data, error } = result;
        if (data) {
            this.leaves = data.map(record => ({
                ...record,
                EmployeeName: record.Employee__r ? record.Employee__r.Name : '',
                isSelected: false
            }));
            this.selectedIds.clear();
        } else if (error) {
            this.showToast('Error', 'Failed to fetch leave requests', 'error');
            console.error(error);
        }
    }

    get hasLeaves() {
        return this.leaves && this.leaves.length > 0;
    }

    get isAllSelected() {
        return this.leaves.length > 0 && this.selectedIds.size === this.leaves.length;
    }

    // Selection Handlers
    handleSelectAll(event) {
        const checked = event.target.checked;
        if (checked) {
            this.leaves = this.leaves.map(leave => {
                this.selectedIds.add(leave.Id);
                return { ...leave, isSelected: true };
            });
        } else {
            this.selectedIds.clear();
            this.leaves = this.leaves.map(leave => ({ ...leave, isSelected: false }));
        }
    }

    handleSelectRow(event) {
        const leaveId = event.target.dataset.id;
        const checked = event.target.checked;
        
        if (checked) {
            this.selectedIds.add(leaveId);
        } else {
            this.selectedIds.delete(leaveId);
        }

        this.leaves = this.leaves.map(leave => {
            if (leave.Id === leaveId) {
                return { ...leave, isSelected: checked };
            }
            return leave;
        });
    }

    // Action Handlers
    async handleApprove(event) {
        const leaveId = event.target.dataset.id;
        await this.processUpdate([leaveId], 'Approved');
    }

    async handleReject(event) {
        const leaveId = event.target.dataset.id;
        await this.processUpdate([leaveId], 'Rejected');
    }

    async handleBulkApprove() {
        if (this.selectedIds.size === 0) {
            this.showToast('Warning', 'Please select at least one record', 'warning');
            return;
        }
        await this.processUpdate(Array.from(this.selectedIds), 'Approved');
    }

    async handleBulkReject() {
        if (this.selectedIds.size === 0) {
            this.showToast('Warning', 'Please select at least one record', 'warning');
            return;
        }
        await this.processUpdate(Array.from(this.selectedIds), 'Rejected');
    }

    // Helper for updating status
    async processUpdate(leaveIds, status) {
        this.isLoading = true;
        try {
            await updateLeaveStatus({ leaveIds: leaveIds, status: status });
            this.showToast('Success', `Leaves ${status} successfully`, 'success');
            await refreshApex(this.wiredLeavesResult);
        } catch (error) {
            this.showToast('Error', error.body ? error.body.message : error.message, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}