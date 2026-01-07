import { LightningElement, api, track } from 'lwc';

// Define radii for the clock rings in pixels
const CLOCK_RADIUS = 130;
const OUTER_RING_RADIUS = CLOCK_RADIUS - 20; // 110px
const INNER_RING_RADIUS = CLOCK_RADIUS - 55; // 75px
const DISTANCE_THRESHOLD = (OUTER_RING_RADIUS + INNER_RING_RADIUS) / 2;

export default class DurationPicker extends LightningElement {
    @api initialHours = 0;
    @api initialMinutes = 0;

    @track view = 'hours';
    @track selectedHour = 0;
    @track selectedMinute = 0;
    @track numbers = [];
    @track activeRing = 'inner';
    
    handAngle = 0;
    isDragging = false;
    clockRect;
    
    _handleDragMove = this.handleDragMove.bind(this);
    _handleDragEnd = this.handleDragEnd.bind(this);

    connectedCallback() {
        this.selectedHour = parseInt(this.initialHours, 10) || 0;
        this.selectedMinute = parseInt(this.initialMinutes, 10) || 0;

        if (this.selectedHour < 0 || this.selectedHour > 23) this.selectedHour = 0;

        if (this.isHourView) {
            this.activeRing = this.selectedHour >= 12 ? 'outer' : 'inner';
        }
        
        this.generateNumbers();
        this.updateHandPositionFromState();
    }
    
    // --- GETTERS ---
    get isHourView() {
        return this.view === 'hours';
    }
    
    get clockFaceClass() {
        return this.isDragging ? 'clock-face is-dragging' : 'clock-face';
    }

    get handContainerClass() {
        let classes = ['clock-hand-container'];
        if (this.isHourView && this.activeRing === 'inner') {
            classes.push('short-hand');
        }
        return classes.join(' ');
    }

    get formattedHour() { return String(this.selectedHour).padStart(2, '0'); }
    get formattedMinute() { return String(this.selectedMinute).padStart(2, '0'); }
    get hourDisplayClass() { return this.isHourView ? 'display-value active' : 'display-value'; }
    get minuteDisplayClass() { return !this.isHourView ? 'display-value active' : 'display-value'; }
    get handStyle() { return `transform: rotate(${this.handAngle}deg);`; }

    // --- UI LOGIC ---
    generateNumbers() {
        this.numbers = [];
        if (this.isHourView) {
            // Outer Ring (12-23)
            for (let i = 12; i <= 23; i++) { this.addNumber(i, i, OUTER_RING_RADIUS, false); }
            // Inner Ring (00-11)
            for (let i = 0; i <= 11; i++) { const display = i === 0 ? '00' : i; this.addNumber(i, display, INNER_RING_RADIUS, true); }
        } else {
            // Minute Ring
            for (let i = 0; i < 12; i++) { const value = i * 5; const display = value === 0 ? '00' : value; this.addNumber(value, display, OUTER_RING_RADIUS, false); }
        }
    }
    
    addNumber(value, display, radius, isInner) {
        let positionOnClock;
        if (this.isHourView) {
            positionOnClock = value % 12;
        } else {
            positionOnClock = value / 5;
        }
        const angle = (positionOnClock / 12) * 2 * Math.PI - (Math.PI / 2);

        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        const style = `transform: translate(${x}px, ${y}px);`;

        let className = 'number';
        if (isInner) { className += ' is-inner'; }

        const selectedValue = this.isHourView ? this.selectedHour : this.selectedMinute;
        if (selectedValue === value) { className += ' selected'; }
        
        this.numbers.push({ value, display, style, className });
    }

    updateValueFromDrag(angle, distance) {
        if (this.isHourView) {
            this.activeRing = distance > DISTANCE_THRESHOLD ? 'outer' : 'inner';
            let hour = Math.round(angle / 30);
            if (hour === 12) hour = 0; // Normalize top position to 0

            this.selectedHour = this.activeRing === 'outer' ? hour + 12 : hour;
        } else {
            let minute = Math.round(angle / 6);
            if (minute === 60) minute = 0;
            this.selectedMinute = minute;
        }
    }

    updateHandPositionFromState() {
        if (this.isHourView) {
            this.handAngle = (this.selectedHour % 12) * 30;
        } else {
            this.handAngle = this.selectedMinute * 6;
        }
    }

    // --- EVENT HANDLERS ---
    handleDragStart(event) {
        event.preventDefault(); this.isDragging = true; this.clockRect = this.template.querySelector('.clock-face').getBoundingClientRect();
        window.addEventListener('mousemove', this._handleDragMove); window.addEventListener('mouseup', this._handleDragEnd);
        window.addEventListener('touchmove', this._handleDragMove, { passive: false }); window.addEventListener('touchend', this._handleDragEnd);
        this.updateAngleFromEvent(event);
    }
    
    handleDragMove(event) {
        event.preventDefault(); if (!this.isDragging) return; this.updateAngleFromEvent(event);
    }
    
    updateAngleFromEvent(event) {
        const point = event.touches ? event.touches[0] : event;
        const x = point.clientX - this.clockRect.left - this.clockRect.width / 2;
        const y = point.clientY - this.clockRect.top - this.clockRect.height / 2;
        
        let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;

        const distance = Math.sqrt(x * x + y * y);

        this.handAngle = angle;
        this.updateValueFromDrag(angle, distance);
        this.generateNumbers();
    }

    handleDragEnd() {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        window.removeEventListener('mousemove', this._handleDragMove);
        window.removeEventListener('mouseup', this._handleDragEnd);
        window.removeEventListener('touchmove', this._handleDragMove);
        window.removeEventListener('touchend', this._handleDragEnd);

        this.updateHandPositionFromState();
        this.generateNumbers();

        // --- RESTORED: Automatically switch to minute view ---
        if (this.isHourView) {
            setTimeout(() => this.switchToMinuteView(), 250);
        }
    }
    
    switchToHourView() { 
        if (!this.isHourView) { 
            this.view = 'hours';
            this.activeRing = this.selectedHour >= 12 ? 'outer' : 'inner';
            this.generateNumbers(); 
            this.updateHandPositionFromState(); 
        } 
    }

    switchToMinuteView() { 
        if (this.isHourView) { 
            this.view = 'minutes'; 
            this.generateNumbers(); 
            this.updateHandPositionFromState(); 
        } 
    }

    handleSet() { this.dispatchEvent(new CustomEvent('set', { detail: { hours: this.selectedHour, minutes: this.selectedMinute } })); }
    handleCancel() { this.dispatchEvent(new CustomEvent('cancel')); }
    disconnectedCallback() { window.removeEventListener('mousemove', this._handleDragMove); window.removeEventListener('mouseup', this._handleDragEnd); window.removeEventListener('touchmove', this._handleDragMove); window.removeEventListener('touchend', this._handleDragEnd); }
}