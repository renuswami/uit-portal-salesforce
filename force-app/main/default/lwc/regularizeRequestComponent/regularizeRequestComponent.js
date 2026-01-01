import { LightningElement, track, api, wire } from 'lwc';
import getAttendanceRecord from '@salesforce/apex/RegularizationController.getAttendanceRecord';
import updateAttendanceRecord from '@salesforce/apex/RegularizationController.updateAttendanceRecord';
import getTotalLoggedHours from '@salesforce/apex/RegularizationController.getTotalLoggedHours';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import DATE_FIELD from '@salesforce/schema/Attendance__c.Attendance_Date__c';
import { getRecord } from 'lightning/uiRecordApi';
import { CloseActionScreenEvent } from 'lightning/actions';


const FIELDS = [DATE_FIELD];


export default class RegularizationComponent extends LightningElement {
    @track selectedDate;
    @track selectedReason;
    @track selectedLeaveType;
    @track checkIn;
    @track checkOut;
    @track totalTime;
    @track description;
    @track attendanceId;
    @track error;
    @track isLoading = false;
    @track attendanceRecord;
    @api recordId;
    @api submitButtonControl = false;


    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    wiredRecord({ data, error }) {
        if (data) {
            try {
                console.log('Regularization wire recordId:', this.recordId);
                console.log('Wire getRecord data:', JSON.stringify(data));
                const raw = data.fields?.Attendance_Date__c?.value;

                if (!raw) {
                    console.warn('Attendance__c.Attendance_Date__c is null on this record; leaving selectedDate empty.');
                    this.selectedDate = null;
                    this.error = null;
                    return;
                }

                const normalized = String(raw).slice(0, 10);

                if (this.selectedDate !== normalized) {
                    this.selectedDate = normalized;
                    Promise.resolve().then(() => {
                        this.prefillLeaveComponent();
                        this.fetchAttendance();
                    });
                }

                this.error = null;
            } catch (e) {
                console.error('Error handling record wire:', e);
            }
        } else if (error) {
            this.error = error?.body?.message || 'Error loading record';
            console.error(error);
        }
    }

    reasonOptions = [
        { label: 'Leave', value: 'Leave' },
        { label: 'Work From Home', value: 'Work From Home' },
        { label: 'Forget to check-in', value: 'Forget to check-in' },
        { label: 'Forget to check-out', value: 'Forget to check-out' },
        { label: 'Other', value: 'Other(add in description)' }
    ];

    get isLeaveReason() {
        return this.selectedReason === 'Leave';
    }

    get isDateLocked() {
        return !!this.attendanceRecord;
    }

    get isRegularizationReason() {
        return this.selectedReason && this.selectedReason !== 'Leave';
    }

    get isTimeLocked() {
        return false;
    }

    get isFutureDate() {
        if (!this.selectedDate) return false;

        const selected = new Date(this.selectedDate);
        const today = new Date();

        selected.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);

        return selected > today;
    }

    get canSubmitRegularization() {
        return !this.isFutureDate || this.isLeaveReason;
    }

    handleLeaveCreated(event) {
        console.log('Leave created from child:', event.detail);
        this.showToast('Success', 'Leave request submitted successfully!', 'success');
        this.resetForm();
    }

    handleToastEvent(event) {
        const { title, message, variant } = event.detail;
        this.showToast(title, message, variant);
    }

    formatDateTime(datetimeStr) {
        if (!datetimeStr) return '';
        const date = new Date(datetimeStr);
        const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
        return localDate.toISOString().slice(0, 16);
    }
    prefillLeaveComponent() {
       
        console.log(this.selectedDate);
        const leaveComponent = this.template.querySelector('c-leave-request-component');
        console.log(leaveComponent);
        if (leaveComponent && this.selectedDate) {
            leaveComponent.handleParentDateChange(this.selectedDate);
        }
    }

    handleDateChange(event) { 
        this.selectedDate = event.target.value;
        if (!this.selectedDate) return;

        if (this.selectedReason && this.isFutureDate && !this.isLeaveReason) {
            this.showToast('Invalid Date', 'You cannot select a future date for regularization. Please select Leave reason for future dates.', 'error');
            this.selectedDate = null;
            return;
        }

        this.prefillLeaveComponent();
        this.fetchAttendance();
    }

    handleReasonChange(event) {
        const previousReason = this.selectedReason;
        this.selectedReason = event.target.value;
        this.error = null;
        console.log('Previous Reason:', previousReason);
        console.log('New Reason:', this.selectedReason);
        console.log('New Reason:', this.selectedDate);
        if (this.selectedReason === 'Leave' && this.selectedDate) {
            setTimeout(() => {
                this.prefillLeaveComponent();
            }, 300);
        }

        if (this.selectedReason !== 'Leave' && this.isFutureDate) {
            this.showToast('Invalid Selection', 'You cannot select future dates for regularization. Please select a past date or change reason to Leave.', 'error');
            this.selectedDate = null;
            setTimeout(() => {
                this.resetAttendanceData();
            }, 300);
        }

        if (previousReason === 'Leave' && this.selectedReason !== 'Leave' && this.isFutureDate) {
            this.showToast('Invalid Selection', 'Future dates are only allowed for Leave requests. Please select a past date.', 'error');
            this.selectedDate = null;
            setTimeout(() => {
                this.resetAttendanceData();
            }, 300);
        }
    }


    fetchAttendance() {
        if (!this.selectedDate) return;

        this.isLoading = true;
        getAttendanceRecord({ selectedDate: this.selectedDate, recordId: this.recordId })
            .then((result) => {
                if (result) {
                    this.attendanceRecord = result;
                    this.attendanceId = result.Id;

                    this.checkIn = this.formatTimeForInput(result.First_Check_In__c);
                    this.checkOut = this.formatTimeForInput(result.Last_Check_Out__c);
                    this.totalTime = this.formatTotalHours(result.Total_Hours_Worked__c);
                    this.description = result.Description__c;

                    console.log('✅ Prefilled values:', {
                        checkIn: this.checkIn,
                        checkOut: this.checkOut,
                        totalTime: this.totalTime,
                        description: this.description
                    });
                } else {
                    this.attendanceRecord = null;
                    this.attendanceId = null;
                    this.checkIn = '';
                    this.checkOut = '';
                    this.totalTime = '';
                    this.description = '';
                }
                this.error = null;
            })
            .catch((error) => {
                console.error('❌ Error fetching attendance:', JSON.stringify(error));
                this.error = error.body?.message || 'An error occurred while fetching attendance record';
                this.showToast('Error', this.error, 'error');
                this.resetAttendanceData();
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    formatTimeForInput(dateTimeValue) {
        if (!dateTimeValue) return '';

        try {
            const dt = new Date(dateTimeValue);

            if (isNaN(dt.getTime())) {
                console.warn('⚠️ Invalid date:', dateTimeValue);
                return '';
            }

            const hours = dt.getHours().toString().padStart(2, '0');
            const minutes = dt.getMinutes().toString().padStart(2, '0');

            return `${hours}:${minutes}`;
        } catch (error) {
            console.error('Error formatting time:', error);
            return '';
        }
    }

    formatTotalHours(totalHours) {
        if (!totalHours && totalHours !== 0) return '';

        try {
            if (typeof totalHours === 'string' && totalHours.includes(':')) {
                return totalHours;
            }

            const numericValue = parseFloat(totalHours);
            if (!isNaN(numericValue)) {
                const hours = Math.floor(numericValue);
                const minutes = Math.round((numericValue - hours) * 60);
                return `${hours}:${minutes.toString().padStart(2, '0')}`;
            }

            return totalHours.toString();
        } catch (error) {
            console.error('Error formatting total hours:', error);
            return totalHours ? totalHours.toString() : '';
        }
    }

    convertToUTC(localTime) {
        if (!localTime || !this.selectedDate) return null;

        const match = localTime.match(/^(\d{2}):(\d{2})/);
        if (!match) {
            console.warn('⚠️ Invalid time format:', localTime);
            return null;
        }

        const cleanTime = `${match[1]}:${match[2]}`;
        const combinedDateTime = `${this.selectedDate}T${cleanTime}:00`;
        const utcString = new Date(combinedDateTime).toISOString();

        return utcString;
    }

    handleCheckInTimeChange(event) {
        this.checkIn = event.target.value;
        this.recalculateTotal();
    }

    handleCheckOutTimeChange(event) {
        this.checkOut = event.target.value;
        this.recalculateTotal();
    }

    recalculateTotal() {
        if (this.checkIn && this.checkOut && this.selectedDate) {
            const [startHours, startMinutes] = this.checkIn.split(':').map(Number);
            const [endHours, endMinutes] = this.checkOut.split(':').map(Number);

            const start = new Date(this.selectedDate);
            start.setHours(startHours, startMinutes, 0, 0);

            const end = new Date(this.selectedDate);
            end.setHours(endHours, endMinutes, 0, 0);

            const diffMs = end - start;

            if (diffMs > 0) {
                const totalMinutes = Math.floor(diffMs / (1000 * 60));
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                this.totalTime = `${hours}:${minutes.toString().padStart(2, '0')}`;
            } else {
                this.totalTime = '';
                this.showToast('Invalid Time', 'Check-out time must be after check-in time.', 'warning');
            }
        }
    }

    handleDescriptionChange(event) {
        this.description = event.target.value;
    }

    async handleSubmit() {
        try {
            this.error = null;

            if (!this.selectedDate || !this.selectedReason) {
                this.showToast('Validation Error', 'Please select a date and reason.', 'warning');
                return;
            }

            if (this.isFutureDate && !this.isLeaveReason) {
                this.showToast('Invalid Date', 'You cannot submit regularization requests for future dates. Please select a past date or choose Leave as the reason.', 'error');
                return;
            }

            if (this.isLeaveReason) {
                const leaveComponent = this.template.querySelector('c-leave-request-component');
                if (leaveComponent) {
                    leaveComponent.handleSubmit();
                }
            } else if (this.isRegularizationReason) {
                if (!this.checkIn || !this.checkOut) {
                    this.showToast('Validation Error', 'Please enter both check-in and check-out times.', 'warning');
                    return;
                }

                if (this.isFutureDate) {
                    this.showToast('Invalid Date', 'Regularization requests are not allowed for future dates.', 'error');
                    return;
                }

                this.isLoading = true;
            
let loggedHours = 0;
let regularizedHours = 0;

if (this.totalTime) {
    const [hours, minutes] = this.totalTime.split(':').map(Number);
    regularizedHours = hours + (minutes / 60);
}

let requiredHours = regularizedHours >= 9 ? 8 : regularizedHours;

try {
    loggedHours = await getTotalLoggedHours({
        selectedDate: this.selectedDate
    });
} catch (err) {
    console.error(err);
    this.error = 'Error validating time log. Please try again.';
    this.isLoading = false;
    return;
}

if (!loggedHours || loggedHours === 0) {
    this.error = 'Please log your time before submitting regularization request!';
    this.isLoading = false;
    return;
}

if (!loggedHours || loggedHours < requiredHours) {
    this.error = `Please log at least ${requiredHours.toFixed(2)} hours. Currently logged: ${loggedHours.toFixed(2)} hours.`;
    this.isLoading = false;
    return;
}

this.error = null;

                

                let totalHoursDecimal = 0;
                if (this.totalTime) {
                    const [hours, minutes] = this.totalTime.split(':').map(Number);
                    totalHoursDecimal = hours + (minutes / 60);
                }

                const payload = {
                    attendanceId: this.recordId,
                    checkIn: this.convertToUTC(this.checkIn),
                    checkOut: this.convertToUTC(this.checkOut),
                    totalTime: totalHoursDecimal, 
                    reason: this.selectedReason,
                    description: this.description,
                    selectedDate: this.selectedDate
                };

                console.log('✅ Payload:', JSON.stringify(payload, null, 2));

                updateAttendanceRecord(payload)
                    .then(() => {
                        this.showToast('Success', 'Regularization request sent successfully!', 'success');
                        this.dispatchEvent(new CloseActionScreenEvent());
                        this.resetForm();
                    })
                    .catch(error => {
                        console.error('Error creating Regularization:', error);
                        const errorMessage = error.body?.message || 'An error occurred while submitting regularization request';

                        if (errorMessage.includes('Please log your time before submitting regularize request!')) {
                            this.error = 'Please log your time before submitting regularization request!';
                        } else {
                            this.error = errorMessage;
                            this.showToast('Error', this.error, 'error');
                        }
                    })
                    .finally(() => {
                        this.isLoading = false;
                    });
            }

        } catch (error) {
            console.error('Unexpected JS Error:', error);
            this.error = 'An unexpected error occurred';
            this.showToast('Error', this.error, 'error');
            this.isLoading = false;
        }
    }

    resetForm() {
        this.selectedDate = null;
        this.selectedReason = null;
        this.selectedLeaveType = null;
        this.checkIn = '';
        this.checkOut = '';
        this.totalTime = '';
        this.description = '';
        this.attendanceId = null;
        this.attendanceRecord = null;
        this.error = null;

        const leaveComponent = this.template.querySelector('c-leave-request-component');
        if (leaveComponent) {
            leaveComponent.resetForm();
        }
    }



    resetAttendanceData() {
        this.attendanceRecord = null;
        this.attendanceId = null;
        this.checkIn = '';
        this.checkOut = '';
        this.totalTime = '';
        this.description = '';
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}