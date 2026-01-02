import { LightningElement, track, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getAllRegularizations from '@salesforce/apex/RegularizationManagerController.getAllRegularizations';
import getEmployees from '@salesforce/apex/RegularizationManagerController.getEmployees';
import updateRegularizationStatus from '@salesforce/apex/RegularizationManagerController.updateRegularizationStatus';
import getTimeLogsByAttendance from '@salesforce/apex/RegularizationManagerController.getTimeLogsByAttendance';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class RegularizationManager extends LightningElement {
    @track regularizations = [];
    @track filteredRegularizations = [];
    @track employees = [];
    @track employeeOptions = [];
    @track selectedEmployeeId = '';
    @track selectedDate = '';
    @track selectedMonth = '';
    @track selectedApprovalStatus = 'Pending';
    selectedIds = new Set();
    sortBy = '';
    sortDirection = 'asc';
    _wiredRegs;
    @track showRejectModal = false;
    @track rejectReason = '';
    @track rejectTargetIds = [];

    monthOptions = [
        { label: 'January', value: '1' },
        { label: 'February', value: '2' },
        { label: 'March', value: '3' },
        { label: 'April', value: '4' },
        { label: 'May', value: '5' },
        { label: 'June', value: '6' },
        { label: 'July', value: '7' },
        { label: 'August', value: '8' },
        { label: 'September', value: '9' },
        { label: 'October', value: '10' },
        { label: 'November', value: '11' },
        { label: 'December', value: '12' }
    ];

    approvalStatusOptions = [
        { label: 'Pending', value: 'Pending' },
        { label: 'Approved', value: 'Approved' },
        { label: 'Rejected', value: 'Rejected' }
    ];

    @wire(getEmployees)
    wiredEmployees({ error, data }) {
        if (data) {
            this.employees = data;
            this.employeeOptions = [
                { label: 'All Employees', value: '' },
                ...data.map(emp => ({
                    label: emp.Name,
                    value: emp.Id
                }))
            ];
        } else if (error) {
            this.showToast('Error', error.body.message, 'error');
        }
    }

    @wire(getAllRegularizations)
    wiredRegs(response) {
        this._wiredRegs = response;
        const { data, error } = response;
        if (data) {
            this.processRegularizations(data);
            this.applyFilters();
        } else if (error) {
            this.showToast('Error', error.body?.message || 'Failed to load regularizations', 'error');
        }
    }

    loadRegularizations() {
        if (this._wiredRegs) {
            refreshApex(this._wiredRegs);
        }
    }

    processRegularizations(data) {
        this.regularizations = data.map((record, index) => {
            const createdByRelName = record.CreatedBy && record.CreatedBy.Name ? record.CreatedBy.Name : null;
            const createdByFlatName = record.CreatedByName ? record.CreatedByName : null;
            const employeeRelName = record.Employee__r && record.Employee__r.Name ? record.Employee__r.Name : null;
            const fallbackFromId = record.CreatedById ? record.CreatedById : '';

            const employeeName = createdByRelName || createdByFlatName || employeeRelName || fallbackFromId;
            const firstCheckIn = record.AttendanceId__r && record.AttendanceId__r.First_Check_In__c ? record.AttendanceId__r.First_Check_In__c : null;
            const lastCheckOut = record.AttendanceId__r && record.AttendanceId__r.Last_Check_Out__c ? record.AttendanceId__r.Last_Check_Out__c : null;
            
            // Enhanced Debugging for Log_Hours__c
            if (index === 0) {
                console.log('=== DEBUG START ===');
                console.log('Record Keys:', Object.keys(record));
                console.log('Log_Hours__c Value:', record.Log_Hours__c);
                console.log('Log_Hours__c Type:', typeof record.Log_Hours__c);
                console.log('=== DEBUG END ===');
            }

            return {
                ...record,
                employeeName,
                Total_Hours1__c: this.formatHours(record.Total_Hours1__c),
                formattedLogHours: this.formatHours(record.Log_Hours__c),
                Log_Hours__c: record.Log_Hours__c,
                statusClass: this.getStatusClass(record.Status__c),
                firstCheckIn: this.formatDateTime(firstCheckIn),
                lastCheckOut: this.formatDateTime(lastCheckOut),
                firstCheckInRaw: firstCheckIn,
                lastCheckOutRaw: lastCheckOut,
                actualWorkHour: this.formatHours(record.AttendanceId__r && record.AttendanceId__r.Work_Hours__c ? record.AttendanceId__r.Work_Hours__c : null),
                isExpanded: false,
                isLoadingLogs: false,
                timeLogs: null,
                hasTimeLogs: false,
                expandedKey: record.Id + '_expanded',
                isSelected: false
            };
        });

    }

    getStatusClass(status) {
        switch(status) {
            case 'Approved':
                return 'slds-text-color_success slds-text-title_bold';
            case 'Rejected':
                return 'slds-text-color_error slds-text-title_bold';
            case 'Pending':
                return 'slds-text-color_warning slds-text-title_bold';
            default:
                return 'slds-text-color_default';
        }
    }

    get hasData() {
        return this.data && this.data.length > 0;
    }

    get totalRecords() {
        return this.data ? this.data.length : 0;
    }

    get pendingCount() {
        return this.data ? 
            this.data.filter(r => r.Approval_Status__c === 'Pending').length : 0;
    }

    get approvedCount() {
        return this.data ? 
            this.data.filter(r => r.Approval_Status__c === 'Approved').length : 0;
    }

    get rejectedCount() {
        return this.data ? 
            this.data.filter(r => r.Approval_Status__c === 'Rejected').length : 0;
    }

    get data() {
        const anyFilterActive = !!(this.selectedEmployeeId || this.selectedDate || this.selectedMonth || this.selectedApprovalStatus);
        const rows = anyFilterActive ? this.filteredRegularizations : this.regularizations;
        return this.sortRows(rows);
    }

    get isSortByName() { return this.sortBy === 'Name'; }
    get isSortByEmployeeName() { return this.sortBy === 'employeeName'; }
    get isSortByFirstCheckin() { return this.sortBy === 'firstCheckInRaw'; }
    get isSortByLastCheckout() { return this.sortBy === 'lastCheckOutRaw'; }
    get isSortByActualHour() { return this.sortBy === 'actualWorkHour'; }
    get isSortByLogHours() { return this.sortBy === 'Log_Hours__c'; }
    get isSortByApprovalStatus() { return this.sortBy === 'Approval_Status__c'; }
    get isSortByStatus() { return this.sortBy === 'Status__c'; }

    // UI helpers for nested table

    handleEmployeeChange(event) {
        this.selectedEmployeeId = event.detail.value;
        this.applyFilters();
    }

    handleDateChange(event) {
        this.selectedDate = event.detail.value;
        if (this.selectedDate) {
            this.selectedMonth = '';
        }
        this.applyFilters();
    }

    handleMonthChange(event) {
        this.selectedMonth = event.detail.value;
        this.applyFilters();
    }

    handleApprovalStatusChange(event) {
        this.selectedApprovalStatus = event.detail.value;
        this.applyFilters();
    }

    clearFilter() {
        this.selectedEmployeeId = '';
        this.selectedDate = '';
        this.selectedMonth = '';
        this.selectedApprovalStatus = 'Pending';
        this.applyFilters();
        this.loadRegularizations();
    }

    applyFilters() {
        let filtered = this.regularizations;

        if (this.selectedEmployeeId) {
            filtered = filtered.filter(reg => reg.CreatedById === this.selectedEmployeeId);
        }

        if (this.selectedDate) {
            const sel = new Date(this.selectedDate);
            const selKey = sel.getUTCFullYear() + '-' + String(sel.getUTCMonth()+1).padStart(2,'0') + '-' + String(sel.getUTCDate()).padStart(2,'0');
            filtered = filtered.filter(reg => {
                if (!reg.Check_in__c) return false;
                const d = new Date(reg.Check_in__c);
                const key = d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0');
                return key === selKey;
            });
        }

        if (this.selectedMonth && !this.selectedDate) {
            filtered = filtered.filter(reg => {
                if (!reg.Check_in__c) return false;
                const regDate = new Date(reg.Check_in__c);
                return (regDate.getUTCMonth() + 1) == Number(this.selectedMonth);
            });
        }


        if (this.selectedApprovalStatus) {
            filtered = filtered.filter(reg => reg.Approval_Status__c === this.selectedApprovalStatus);
        }

        this.filteredRegularizations = filtered;
    }

    handleViewClick(event) {
        const id = event.currentTarget?.dataset?.id;
        if (!id) return;
        const reg = this.regularizations.find(r => r.Id === id);
        if (!reg) return;
        reg.isExpanded = !reg.isExpanded;
        // Load time logs when expanding first time
        if (reg.isExpanded && !reg.timeLogs) {
            reg.isLoadingLogs = true;
            getTimeLogsByAttendance({ recordId: id })
                .then(result => {
                    reg.timeLogs = (result || []).map(log => ({
                        ...log,
                        formattedDate: this.formatDate(log.Date__c),
                        billableHours: this.formatHours(log.Hours__c),
                        nonBillableHours: this.formatHours(log.Non_Billable__c),
                        taskName: log.Task__r && log.Task__r.Name ? log.Task__r.Name : ''
                    }));
                    reg.hasTimeLogs = reg.timeLogs && reg.timeLogs.length > 0;
                })
                .catch(error => {
                    reg.timeLogs = [];
                    reg.hasTimeLogs = false;
                    const msg = error?.body?.message || error?.message || 'Failed to fetch time logs';
                    this.showToast('Error', msg, 'error');
                })
                .finally(() => {
                    reg.isLoadingLogs = false;
                    this.regularizations = [...this.regularizations];
                });
        } else {
            this.regularizations = [...this.regularizations];
        }
    }

    handleApproveClick(event) {
        const id = event.currentTarget?.dataset?.id;
        if (id) {
            this.handleStatusUpdate(id, 'Approved');
        }
    }

    handleRejectClick(event) {
        const id = event.currentTarget?.dataset?.id;
        if (!id) return;
        this.rejectTargetIds = [id];
        this.rejectReason = '';
        this.showRejectModal = true;
    }

    handleRejectReasonChange(event) {
        this.rejectReason = (event.target && event.target.value) || (event.detail && event.detail.value) || '';
        console.log('Reject Reason:', this.rejectReason);
    }

    handleSelectRowChange(event) {
        const id = event.currentTarget?.dataset?.id;
        const checked = event.target?.checked;
        if (!id) return;
        if (checked) {
            this.selectedIds.add(id);
        } else {
            this.selectedIds.delete(id);
        }
        this.updateSelectionFlags();
    }

    handleSelectAllChange(event) {
        const checked = event.target?.checked;
        const visibleIds = (this.data || []).map(r => r.Id);
        if (checked) {
            visibleIds.forEach(id => this.selectedIds.add(id));
        } else {
            visibleIds.forEach(id => this.selectedIds.delete(id));
        }
        this.updateSelectionFlags();
    }

    updateSelectionFlags() {
        const ids = this.selectedIds;
        this.regularizations = this.regularizations.map(r => ({ ...r, isSelected: ids.has(r.Id) }));
        this.filteredRegularizations = this.filteredRegularizations.map(r => ({ ...r, isSelected: ids.has(r.Id) }));
    }

    get isAllSelected() {
        const rows = this.data || [];
        if (rows.length === 0) return false;
        return rows.every(r => this.selectedIds.has(r.Id));
    }
    

    async handleStatusUpdate(recordId, newStatus) {
        try {
            await updateRegularizationStatus({
                recordId: recordId,
                newStatus: newStatus,
                rejectReason: null
            });
            
            this.showToast('Success', `Regularization ${newStatus.toLowerCase()} successfully`, 'success');
            this.loadRegularizations();
        } catch (error) {
            this.showToast('Error', error.body.message, 'error');
        }
    }

    async handleBulkApprove() {
        await this.bulkUpdate('Approved');
    }

    async handleBulkReject() {
        const ids = Array.from(this.selectedIds || []);
        if (!ids.length) {
            this.showToast('Warning', 'Select at least one record first.', 'warning');
            return;
        }
        this.rejectTargetIds = ids;
        this.rejectReason = '';
        this.showRejectModal = true;
    }

    async bulkUpdate(newStatus) {
        if (!this.selectedIds || this.selectedIds.size === 0) {
            this.showToast('Warning', 'Select at least one record first.', 'warning');
            return;
        }
        const count = this.selectedIds.size;
        try {
            for (const id of this.selectedIds) {
                await updateRegularizationStatus({ recordId: id, newStatus, rejectReason: null });
            }
            this.showToast('Success', `Successfully ${newStatus.toLowerCase()} ${count} record(s).`, 'success');
            this.selectedIds = new Set();
            this.updateSelectionFlags();
            this.loadRegularizations();
        } catch (error) {
            const msg = error?.body?.message || error?.message || 'Bulk update failed';
            this.showToast('Error', msg, 'error');
        }
    }

    closeRejectModal() {
        this.showRejectModal = false;
        this.rejectReason = '';
        this.rejectTargetIds = [];
    }

    async submitRejectReason() {
        const input = this.template.querySelector('lightning-input[name="rejectReason"]');
        const reason = ((input && input.value) || this.rejectReason || '').trim();
        if (!reason) {
            this.showToast('Warning', 'Please enter a reason to reject.', 'warning');
            return;
        }
        try {
            for (const id of this.rejectTargetIds) {
                await updateRegularizationStatus({ recordId: id, newStatus: 'Rejected', rejectReason: reason });
            }
            this.showToast('Success', `Rejected ${this.rejectTargetIds.length} record(s).`, 'success');
            this.closeRejectModal();
            this.selectedIds = new Set();
            this.updateSelectionFlags();
            this.loadRegularizations();
        } catch (error) {
            const msg = error?.body?.message || error?.message || 'Reject failed';
            this.showToast('Error', msg, 'error');
        }
    }

    handleSort(event) {
        const field = event.currentTarget?.dataset?.field;
        if (!field) return;
        if (this.sortBy === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortBy = field;
            this.sortDirection = 'asc';
        }
    }

    sortRows(rows) {
        if (!rows || rows.length === 0 || !this.sortBy) return rows;
        const dir = this.sortDirection === 'asc' ? 1 : -1;
        const field = this.sortBy;
        const getVal = (r) => {
            const v = r[field];
            return v;
        };
        const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
        const copy = [...rows];
        copy.sort((a,b) => {
            const va = getVal(a);
            const vb = getVal(b);
            if (va === vb) return 0;
            if (va === undefined || va === null) return -1 * dir;
            if (vb === undefined || vb === null) return 1 * dir;
            const na = typeof va === 'number' ? va : (typeof va === 'string' ? Number(va) : NaN);
            const nb = typeof vb === 'number' ? vb : (typeof vb === 'string' ? Number(vb) : NaN);
            if (!Number.isNaN(na) && !Number.isNaN(nb)) {
                return (na - nb) * dir;
            }
            const da = (typeof va === 'string' || typeof va === 'number') && String(va).includes('T') ? new Date(va) : null;
            const db = (typeof vb === 'string' || typeof vb === 'number') && String(vb).includes('T') ? new Date(vb) : null;
            if (da && db) {
                return (da.getTime() - db.getTime()) * dir;
            }
            const sa = String(va);
            const sb = String(vb);
            return collator.compare(sa, sb) * dir;
        });
        return copy;
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }

    formatDateTime(dt) {
        if (!dt) return '';
        let d = new Date(dt);

        return (
            d.toLocaleDateString('en-GB') + ' ' + 
            d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        );
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB');
    }

    formatHours(val) {
        if (val === null || val === undefined || val === '') return '0.00';
        const num = Number(val);
        if (Number.isNaN(num)) return String(val); // Fallback for strings/time
        return num.toFixed(2);
    }
}