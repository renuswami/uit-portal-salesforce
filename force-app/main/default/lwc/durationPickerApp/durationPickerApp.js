import { LightningElement, api, track } from 'lwc';

export default class DurationPickerApp extends LightningElement {
    // --- NEW PROPERTIES FOR FLOW ---
    
    /**
     * INPUT: The title to display on the lightning-card.
     * We'll set this to "Log Time" in the Flow Builder.
     */
    @api cardTitle = 'Duration Picker Demo'; // Default value

    /**
     * OUTPUT: This will hold the final calculated decimal hours as a String.
     * The Flow will read this value after the user makes a selection.
     */
    @api totalHours; 

    // --- EXISTING PROPERTIES ---
    @track showPicker = false;
    @track selectedHours = 0;
    @track selectedMinutes = 0;

    get durationString() {
        const h = String(this.selectedHours).padStart(2, '0');
        const m = String(this.selectedMinutes).padStart(2, '0');
        return `${h} hours and ${m} minutes`;
    }

    openPicker() {
        this.showPicker = true;
    }

    handlePickerCancel() {
        this.showPicker = false;
    }

    handleDurationSet(event) {
        const { hours, minutes } = event.detail;
        this.selectedHours = hours;
        this.selectedMinutes = minutes;
        this.showPicker = false;

        // --- NEW LOGIC TO POPULATE THE OUTPUT FOR THE FLOW ---
        const calculatedTotal = hours + (minutes / 60);
        
        // Convert the result to a string with 2 decimal places.
        // This string will be automatically converted to a Number by the Flow.
        this.totalHours = calculatedTotal.toFixed(2);
    }
}