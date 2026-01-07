import { LightningElement, track, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getEmployeeLeaveBalance from '@salesforce/apex/LeaveController.getEmployeeLeaveBalance';
import applyForLeave from '@salesforce/apex/LeaveController.applyForLeave';

export default class LeaveRequestComponent extends LightningElement {

    @api submitButtonControl = false;
    @api recordId;

    @track startDate;
    @track endDate;
    @track totalDays = 0;
    @track leaveType;
    @track dayType = 'Full Day';
    @track halfDayType = '1st Half';
    @track description;
    @track leaveBalances = {};
    @track isLoading = true;

    leaveTypeOptions = [
        { label: 'Sick Leave', value: 'Sick Leave' },
        { label: 'Casual Leave', value: 'Casual Leave' },
        { label: 'Unpaid Leave', value: 'Unpaid Leave' }
    ];

    dayTypeOptions = [
        { label: 'Full Day', value: 'Full Day' },
        { label: 'Half Day', value: 'Half Day' }
    ];

    halfDayOptions = [
        { label: '1st Half', value: '1st Half' },
        { label: '2nd Half', value: '2nd Half' }
    ];

    connectedCallback() {
        this.loadLeaveBalances();
    }

    loadLeaveBalances() {
        this.isLoading = true;
        getEmployeeLeaveBalance()
            .then(result => {
                console.log('Leave balances loaded:', JSON.stringify(result));
                this.leaveBalances = result || {};

                // Debug log all balances
                Object.keys(this.leaveBalances).forEach(key => {
                    console.log(`Balance for ${key}:`, this.leaveBalances[key]);
                });
            })
            .catch(error => {
                console.error('Error loading leave balances:', error);
                this.showToast('Error', 'Failed to load leave balances: ' + error.body?.message, 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    get balanceInfo() {
        if (this.leaveBalances && this.leaveType) {
            const balance = this.leaveBalances[this.leaveType];
            const num = Number(balance);
            if (Number.isFinite(num)) {
                return `Available Balance: ${num} days`;
            }
            return `Available Balance: 0 days`;
        }
        return 'Available Balance: Select leave type';
    }

    handleStartDateChange(event) {
        this.startDate = event.target.value;
        this.calculateTotalDays();
    }

    handleEndDateChange(event) {
        this.endDate = event.target.value;
        this.calculateTotalDays();
    }

    handleLeaveTypeChange(event) {
        this.leaveType = event.target.value;
        console.log('Leave type changed to:', this.leaveType);
    }

    handleDayTypeChange(event) {
        this.dayType = event.detail.value;
        this.calculateTotalDays();
    }

    handleHalfDayChange(event) {
        this.halfDayType = event.detail.value;
    }

    handleDescriptionChange(event) {
        this.description = event.target.value;
    }

    calculateTotalDays() {
        if (this.startDate && this.endDate) {
            const start = new Date(this.startDate);
            const end = new Date(this.endDate);

            if (end < start) {
                this.totalDays = 0;
                return;
            }

            // Calculate difference in days
            const diffTime = end.getTime() - start.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24)) + 1;
            this.totalDays = diffDays;
        } else {
            this.totalDays = 0;
        }
    }

    @api
    async handleSubmit() {
        this.isLoading = true;
        console.log('Submitting leave application...');

        try {
            // Validation
            const validation = this.validateLeaveData();
            if (!validation.isValid) {
                this.showToast('Validation Error', validation.error, 'warning');
                this.isLoading = false;
                return { success: false, error: validation.error };
            }

            // Check balance
            const balanceCheck = this.checkLeaveBalance();
            if (!balanceCheck.isValid) {
                this.showToast('Insufficient Balance', balanceCheck.error, 'warning');
                this.isLoading = false;
                return { success: false, error: balanceCheck.error };
            }

            console.log('Calling Apex with data:', {
                leaveType: this.leaveType,
                requiredDays: balanceCheck.requiredDays,
                startDate: this.startDate,
                endDate: this.endDate,
                dayType: this.dayType,
                halfDayType: this.halfDayType,
                description: this.description
            });

            // Apply for leave
            const result = await applyForLeave({
                leaveType: this.leaveType,
                requiredDays: balanceCheck.requiredDays,
                startDate: this.startDate,
                endDate: this.endDate,
                dayType: this.dayType,
                // halfDayType: this.halfDayType,
                dayType: this.dayType === 'Half Day' ? this.halfDayType : this.dayType,

                description: this.description
            });

            // Reload balances
            this.loadLeaveBalances();

            // Notify parent
            this.dispatchEvent(new CustomEvent('leavecreated'));
            this.showToast('Success', 'Leave request submitted successfully!', 'success');

            this.resetForm();
            return { success: true };

        } catch (error) {
            console.error('Error applying leave:', error);
            const errorMsg = error.body?.message || error.message || 'Failed to apply leave';
            this.showToast('Error', errorMsg, 'error');
            return { success: false, error: errorMsg };
        } finally {
            this.isLoading = false;
        }
    }

    @api
    handleParentDateChange(parentDate) {
        if (parentDate) {
            // Prefill both start and end date with parent date
            this.startDate = parentDate;
            this.endDate = parentDate;
            this.calculateTotalDays();
            console.log('Dates prefilled from parent:', parentDate);
        }
    }

    checkLeaveBalance() {
        if (!this.leaveType || !this.leaveBalances) {
            return { isValid: false, error: 'Please select leave type.' };
        }

        const requiredDays = Number(this.getCalculatedDays());
        const availableBalance = Number(this.leaveBalances[this.leaveType]);

        console.log(`Balance check - Type: ${this.leaveType}, Available: ${availableBalance}, Required: ${requiredDays}`);
        if (this.leaveType === 'Unpaid Leave') {
            return {
                isValid: true,
                requiredDays: this.getCalculatedDays()
            };
        }
        if (!Number.isFinite(availableBalance)) {
            return { isValid: false, error: 'Invalid leave type selected or balance not loaded.' };
        }

        if (availableBalance < requiredDays) {
            return {
                isValid: false,
                error: `Insufficient ${this.leaveType} balance. Available: ${availableBalance}, Required: ${requiredDays}`
            };
        }

        return { isValid: true, requiredDays: requiredDays };
    }

    validateLeaveData() {
        if (!this.startDate || !this.endDate || !this.leaveType) {
            return { isValid: false, error: 'Please fill in all required fields.' };
        }

        const start = new Date(this.startDate);
        const end = new Date(this.endDate);
        const today = new Date();

        // Reset time part for accurate day comparison
        today.setHours(0, 0, 0, 0);
        start.setHours(0, 0, 0, 0);

        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(today.getMonth() - 1);

        if (this.leaveType === 'Sick Leave' && start < oneMonthAgo) {
            return {
                isValid: false,
                error: 'Sick Leave cannot be applied for dates older than 1 month.'
            };
        }

        if (end < start) {
            return { isValid: false, error: 'End date cannot be before start date.' };
        }

        // Check if start date is in the past
        if (start < today && this.leaveType === 'Casual Leave') {
            return { isValid: false, error: 'Casual Leave cannot be applied for past dates.' };
        }

        // Casual leave validation - must be applied at least 2 days in advance
        if (this.leaveType === 'Casual Leave') {
            const timeDiff = start.getTime() - today.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

            console.log('Casual Leave - Days in advance:', daysDiff);

            if (daysDiff < 2) {
                return {
                    isValid: false,
                    error: 'Casual Leave must be applied at least 2 days in advance!'
                };
            }
        }

        // UNPAID LEAVE VALIDATION - ONLY PAST & PRESENT (NO FUTURE)
        if (this.leaveType === 'Unpaid Leave') {
            const timeDiff = start.getTime() - today.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

            console.log('Unpaid Leave - Days difference:', daysDiff);

            if (daysDiff > 0) {
                return {
                    isValid: false,
                    error: 'Unpaid Leave can only be applied for past or current dates.'
                };
            }
        }


        // ADD SICK LEAVE VALIDATION - 1 DAY IN FUTURE
        if (this.leaveType === 'Sick Leave') {
            const timeDiff = start.getTime() - today.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

            console.log('Sick Leave - Days in future:', daysDiff);

            if (daysDiff > 1) {
                return {
                    isValid: false,
                    error: 'Sick leave can only be applied 1 day in advance!.'
                };
            }
        }

        if (this.dayType === 'Half Day' && !this.halfDayType) {
            return { isValid: false, error: 'Please select Half Day Type.' };
        }

        return { isValid: true };
    }

    getCalculatedDays() {
        if (this.dayType === 'Half Day') {
            return 0.5;
        } else {
            return this.totalDays;
        }
    }

    get totalDaysDisplay() {
        const calculatedDays = this.getCalculatedDays();
        return `${calculatedDays} Day(s)`;
    }

    get showHalfDayOptions() {
        return this.dayType === 'Half Day';
    }

    @api
    resetForm() {
        this.startDate = null;
        this.endDate = null;
        this.totalDays = 0;
        this.leaveType = null;
        this.dayType = 'Full Day';
        this.halfDayType = '1st Half';
        this.description = null;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title,
            message,
            variant
        }));
    }
}