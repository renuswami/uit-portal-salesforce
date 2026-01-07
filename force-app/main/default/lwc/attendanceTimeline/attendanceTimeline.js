import { LightningElement, wire, track } from 'lwc';
import getAttendanceData from '@salesforce/apex/AttendanceTimelineController.getAttendanceData';

const TIMELINE_START_HOUR = 9;
const TIMELINE_END_HOUR = 24; // 24 = midnight at the *end* of the day
const TOTAL_TIMELINE_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;

export default class AttendanceTimeline extends LightningElement {
    @track dailyData = [];
    @track error;
    isLoading = true;

    // Week navigation reference (stores Date of current "today" reference)
    @track referenceDate = new Date();

    // Derived date range based on referenceDate => Monday..Sunday
    get weekStart() {
        const d = new Date(this.referenceDate);
        const day = d.getDay(); // 0=Sun..6=Sat
        const diffToMonday = (day === 0 ? -6 : 1 - day);
        d.setDate(d.getDate() + diffToMonday);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    get weekEnd() {
        const d = new Date(this.weekStart);
        d.setDate(d.getDate() + 6);
        d.setHours(23, 59, 59, 999);
        return d;
    }

    get queryStartDate() {
        return this.weekStart.toISOString().split('T')[0];
    }
    get queryEndDate() {
        return this.weekEnd.toISOString().split('T')[0];
    }

    // Header labels
    get weekRangeLabel() {
        const opts = { month: 'short', day: 'numeric' };
        const start = this.weekStart.toLocaleDateString(undefined, opts);
        const end = this.weekEnd.toLocaleDateString(undefined, opts);
        return `${start} - ${end}`;
    }

    // Actions
    handlePrevWeek() {
        const d = new Date(this.referenceDate);
        d.setDate(d.getDate() - 7);
        this.referenceDate = d;
    }
    handleNextWeek() {
        const d = new Date(this.referenceDate);
        d.setDate(d.getDate() + 7);
        this.referenceDate = d;
    }
    handleToday() {
        this.referenceDate = new Date();
    }

    get noData() {
        return !this.isLoading && !this.error && this.dailyData.length === 0;
    }

    get errorMessage() {
        if (this.error) {
            if (Array.isArray(this.error.body)) {
                return this.error.body.map(e => e.message).join(', ');
            } else if (this.error.body && typeof this.error.body.message === 'string') {
                return this.error.body.message;
            }
        }
        return 'An unknown error occurred.';
    }

    @wire(getAttendanceData, { startDate: '$queryStartDate', endDate: '$queryEndDate' })
    wiredData(result) {
        this.isLoading = true;
        if (result.data) {
            this.dailyData = result.data.map(day => {
                const processedSessions = (day.sessions || []).map(session => {
                    const barStyle = this.calculateBarStyle(session);
                    const colorClass = this.getSessionColorClass(day.status);
                    const tooltip = this.buildTooltip(session);
                    return { ...session, barStyle, colorClass, tooltip };
                });
                return {
                    ...day,
                    hasSessions: processedSessions.length > 0,
                    sessions: processedSessions,
                    statusClass: this.getStatusPillClass(day.status),
                    dayOfWeekShort: this.getShortDayLabel(day.dayOfWeek),
                    dayLabelShort: this.getShortDateLabel(day.dayLabel)
                };
            });
            this.error = undefined;
            this.isLoading = false;
        } else if (result.error) {
            this.error = result.error;
            this.dailyData = [];
            this.isLoading = false;
        }
    }

    /**
     * [FIXED] Calculates the bar style using full Date objects
     * to correctly handle timezones and overnight sessions.
     */
    calculateBarStyle(session) {
        // --- 1. Get full Date objects for check-in and check-out ---
        // new Date() correctly parses the ISO string from Apex into
        // the user's local timezone.
        const checkIn = new Date(session.Check_In__c);
        const checkOut = new Date(session.Check_Out__c);

        // --- 2. Define the timeline boundaries for THIS day ---
        // We use the checkIn date as the reference for "today"
        const timelineStart = new Date(checkIn);
        timelineStart.setHours(TIMELINE_START_HOUR, 0, 0, 0); // 9:00:00 AM local

        const timelineEnd = new Date(checkIn);
        // setHours(24) correctly rolls over to 00:00:00 the *next* day
        timelineEnd.setHours(TIMELINE_END_HOUR, 0, 0, 0); // 12:00:00 AM (midnight) local

        // --- 3. Get millisecond timestamps for all points ---
        const totalTimelineMillis = timelineEnd.getTime() - timelineStart.getTime(); // Total duration of the bar (15 hrs)
        const checkInTime = checkIn.getTime();
        const checkOutTime = checkOut.getTime();
        const timelineStartTime = timelineStart.getTime();
        const timelineEndTime = timelineEnd.getTime();

        // --- 4. Cap the session times to fit within the 9AM-12AM window ---
        // This handles sessions that start before 9AM or end after 12AM.
        const cappedCheckInTime = Math.max(checkInTime, timelineStartTime);
        const cappedCheckOutTime = Math.min(checkOutTime, timelineEndTime);

        // --- 5. Calculate pixel-perfect duration and offset ---
        const durationMillis = Math.max(0, cappedCheckOutTime - cappedCheckInTime);
        const offsetMillis = Math.max(0, cappedCheckInTime - timelineStartTime);

        // --- 6. Convert to percentage for CSS ---
        const widthPercent = (durationMillis / totalTimelineMillis) * 100;
        const marginLeftPercent = (offsetMillis / totalTimelineMillis) * 100;

        if (widthPercent <= 0) return 'display: none;';
        
        const minWidthPercent = 0.6;
        const appliedWidth = Math.max(widthPercent - 0.2, minWidthPercent); // -0.2 provides a small gap

        return `margin-left: ${marginLeftPercent}%; width: ${appliedWidth}%;`;
    }

    getSessionColorClass(status) {
        switch ((status || '').toLowerCase()) {
            case 'present':
            case 'partial':
                return 'session-present';
            case 'holiday':
                return 'session-holiday';
            case 'weekend':
                return 'session-weekend';
            case 'absent':
                return 'session-absent';
            default:
                return 'session-default';
        }
    }

    getStatusPillClass(status) {
        const s = (status || '').toLowerCase();
        if (s === 'present') return 'pill pill-success';
        if (s === 'partial') return 'pill pill-info';
        if (s === 'absent') return 'pill pill-error';
        if (s === 'holiday') return 'pill pill-warning';
        if (s === 'weekend') return 'pill pill-neutral';
        return 'pill pill-default';
    }

    buildTooltip(session) {
        try {
            const inDt = new Date(session.Check_In__c);
            const outDt = new Date(session.Check_Out__c);
            const inStr = this.formatTime(inDt);
            const outStr = this.formatTime(outDt);
            const dur = this.formatDuration(session.Duration_Hours__c);
            return `In: ${inStr}\nOut: ${outStr}\nDuration: ${dur}`;
        } catch (e) {
            return '';
        }
    }

    formatTime(date) {
        // Use local time, not UTC
        const opts = { hour: '2-digit', minute: '2-digit' };
        return date.toLocaleTimeString(undefined, opts);
    }

    formatDuration(hoursDecimal) {
        const totalMinutes = Math.round((Number(hoursDecimal) || 0) * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h}h ${m}m`;
    }

    getShortDayLabel(dayOfWeek) {
        return (dayOfWeek || '').slice(0, 3);
    }

    getShortDateLabel(dayLabel) {
        return dayLabel || '';
    }

    // Weekly summary
    get weeklyTotalHours() {
        const sum = this.dailyData.reduce((acc, d) => acc + (Number(d.totalHours) || 0), 0);
        return this.formatDuration(sum);
    }
    get presentDays() {
        return this.dailyData.filter(d => (d.status || '').toLowerCase() === 'present').length;
    }
    get absentDays() {
        return this.dailyData.filter(d => (d.status || '').toLowerCase() === 'absent').length;
    }
}