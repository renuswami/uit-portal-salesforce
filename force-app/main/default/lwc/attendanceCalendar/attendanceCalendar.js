import { LightningElement, track, wire, api } from 'lwc';
import getCalendarData from '@salesforce/apex/AttendanceCalendarController.getCalendarData';
import { NavigationMixin } from 'lightning/navigation';
import currentUserId from '@salesforce/user/Id';

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default class AttendanceCalendar extends NavigationMixin(LightningElement) {
    @api recordId;
    currentUserId = currentUserId;
    @track currentMonthIndex; // 0-11
    @track currentYear;
    @track calendarDays = [];
    @track isLoading = false;
    @track selectedDateData = null; // For modal
    @track showRegularization = false;

    weekdays = WEEKDAYS;
    
    // Cache for data
    attendanceMap = new Map();
    holidayMap = new Map();
    leaveMap = new Map();

    connectedCallback() {
        const today = new Date();
        this.currentMonthIndex = today.getMonth();
        this.currentYear = today.getFullYear();
        this.generateCalendar();
    }

    get currentMonthName() {
        return MONTH_NAMES[this.currentMonthIndex];
    }

    get formattedSelectedDate() {
        if (!this.selectedDateData || !this.selectedDateData.date) return '';
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(this.selectedDateData.date).toLocaleDateString(undefined, options);
    }

    // Determine which ID to use: passed recordId (if on a record page) or current logged-in user ID
    get effectiveEmployeeId() {
        return this.recordId ? this.recordId : this.currentUserId;
    }

    @wire(getCalendarData, { month: '$wiredMonth', year: '$currentYear', employeeId: '$effectiveEmployeeId' })
    wiredCalendarData({ error, data }) {
        if (data) {
            this.processData(data);
            this.generateCalendar();
            this.isLoading = false;
        } else if (error) {
            console.error('Error fetching calendar data:', error);
            this.isLoading = false;
        }
    }

    // Apex expects month 1-12, JS uses 0-11
    get wiredMonth() {
        return this.currentMonthIndex + 1;
    }

    processData(data) {
        this.attendanceMap.clear();
        this.holidayMap.clear();
        this.leaveMap.clear();

        if (data.attendanceList) {
            data.attendanceList.forEach(att => {
                // Key: YYYY-MM-DD
                this.attendanceMap.set(att.Attendance_Date__c, att);
            });
        }

        if (data.holidayList) {
            data.holidayList.forEach(hol => {
                this.holidayMap.set(hol.Date__c, hol);
            });
        }

        if (data.leaveList) {
            data.leaveList.forEach(leave => {
                // Expand date range
                let start = new Date(leave.Start_Date__c);
                const end = new Date(leave.End_Date__c);
                
                // Safety check to prevent infinite loops if data is bad
                let loopCount = 0;
                while (start <= end && loopCount < 366) {
                    const dateStr = this.formatDateISO(start);
                    // Only map if not already mapped or override logic?
                    // Assuming last leave wins or just first one found.
                    if (!this.leaveMap.has(dateStr)) {
                        this.leaveMap.set(dateStr, leave);
                    }
                    start.setDate(start.getDate() + 1);
                    loopCount++;
                }
            });
        }
    }

    generateCalendar() {
        const days = [];
        
        // 1. Determine first day of month (0=Sun, 6=Sat)
        const firstDayOfMonth = new Date(this.currentYear, this.currentMonthIndex, 1).getDay();
        
        // 2. Days in current month
        const daysInMonth = new Date(this.currentYear, this.currentMonthIndex + 1, 0).getDate();
        
        // 3. Days in previous month (for padding)
        const daysInPrevMonth = new Date(this.currentYear, this.currentMonthIndex, 0).getDate();

        // Previous Month Padding
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            days.push({
                key: `prev-${i}`,
                dayNumber: daysInPrevMonth - i,
                cssClass: 'day-cell disabled',
                hasData: false
            });
        }

        // Current Month Days
        const todayStr = new Date().toISOString().split('T')[0];

        for (let i = 1; i <= daysInMonth; i++) {
            // Create Date string YYYY-MM-DD (local time safety)
            // Note: JS Date month is 0-indexed, but ISO string needs 01-12.
            // Using a helper to ensure correct format without timezone issues
            const dateObj = new Date(this.currentYear, this.currentMonthIndex, i);
            const dateStr = this.formatDateISO(dateObj);
            
            const isSunday = dateObj.getDay() === 0;
            const isToday = dateStr === todayStr;

            let dayObj = {
                key: dateStr,
                dateStr: dateStr,
                dayNumber: i,
                cssClass: `day-cell ${isToday ? 'today' : ''} ${isSunday ? 'sunday' : ''}`,
                hasData: false,
                status: '',
                badgeClass: '',
                showHours: false,
                workHours: ''
            };

            // Map Data Priority: Holiday > Leave > Attendance > Default
            const holiday = this.holidayMap.get(dateStr);
            const attendance = this.attendanceMap.get(dateStr);
            const leave = this.leaveMap.get(dateStr);

            if (holiday) {
                dayObj.hasData = true;
                dayObj.status = holiday.Name || 'Holiday';
                dayObj.badgeClass = 'attendance-badge status-holiday';
            } else if (leave) {
                dayObj.hasData = true;
                // Use Leave Type or "Leave"
                // dayObj.status = leave.Leave_Type__c || 'Leave';

                // Combined status: Leave Type + Day Type (if exists)
                let statusText = leave.Leave_Type__c || 'Leave';
                if (leave.Day_Type__c) {
                    statusText += ` - ${leave.Day_Type__c}`;
                }
                dayObj.status = statusText;

                dayObj.badgeClass = 'attendance-badge status-leave-gradient';
                // If there's an attendance record on a leave day (e.g. partial day?), maybe show hours?
                // For now, simple override.
            } else if (attendance) {
                dayObj.hasData = true;
                dayObj.status = attendance.Status__c || 'Present'; // Fallback
                dayObj.workHours = attendance.Work_Hours__c || (attendance.Total_Hours_Worked__c ? attendance.Total_Hours_Worked__c + ' Hrs' : '');
                dayObj.showHours = !!dayObj.workHours;
                
                // Determine Badge Class based on status
                const statusLower = (attendance.Status__c || '').toLowerCase();
                if (statusLower.includes('absent')) {
                    dayObj.badgeClass = 'attendance-badge status-absent';
                } else if (statusLower.includes('half')) {
                    dayObj.badgeClass = 'attendance-badge status-half-day';
                } else if (statusLower.includes('leave')) {
                    // This is 'Leave' status from Attendance record, not Leave object. 
                    // Can use standard leave style or gradient if preferred.
                    dayObj.badgeClass = 'attendance-badge status-leave'; 
                    dayObj.showHours = false; 
                } else {
                    dayObj.badgeClass = 'attendance-badge status-present';
                }
            } else if (isSunday) {
                // Optional: Label Sunday if needed, but requirements just say visual difference
            }

            days.push(dayObj);
        }

        // Next Month Padding (to fill the last row)
        const totalSlots = days.length;
        const remainingSlots = 7 - (totalSlots % 7);
        if (remainingSlots < 7) {
            for (let i = 1; i <= remainingSlots; i++) {
                days.push({
                    key: `next-${i}`,
                    dayNumber: i,
                    cssClass: 'day-cell disabled',
                    hasData: false
                });
            }
        }

        this.calendarDays = days;
    }

    formatDateISO(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    handlePreviousMonth() {
        this.isLoading = true;
        if (this.currentMonthIndex === 0) {
            this.currentMonthIndex = 11;
            this.currentYear -= 1;
        } else {
            this.currentMonthIndex -= 1;
        }
        this.generateCalendar();
    }

    handleNextMonth() {
        this.isLoading = true;
        if (this.currentMonthIndex === 11) {
            this.currentMonthIndex = 0;
            this.currentYear += 1;
        } else {
            this.currentMonthIndex += 1;
        }
        this.generateCalendar();
    }


    formatTime(dateTimeStr) {
        if (!dateTimeStr) return null;
        return new Date(dateTimeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    openRegularizationModal() {
        this.showRegularization = true;
    }

    closeRegularizationModal() {
        this.showRegularization = false;
    }
}