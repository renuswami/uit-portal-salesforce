import { LightningElement, track, wire } from 'lwc';
import submitApplication from '@salesforce/apex/CandidateController.submitApplication'; 
import { ShowToastEvent } from 'lightning/platformShowToastEvent'; 
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import ACCOUNT_OBJECT from '@salesforce/schema/Account';
import BILLING_COUNTRY_CODE from '@salesforce/schema/Account.BillingCountryCode';
import BILLING_STATE_CODE from '@salesforce/schema/Account.BillingStateCode';

export default class ApplicationForm extends LightningElement { 
    @track candidate = {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        position: '',
        currentAddress: {
            street: '',
            city: '',
            province: '',
            postalCode: '',
            country: ''
        },
        CAddressEqualsPAddress:false,
        permanentAddress: {
            street: '',
            city: '',
            province: '',
            postalCode: '',
            country: ''
        },
        highestDegree: '',
        universityName: '',
        graduationYear: '',

        hasPriorExperience: false,
        yearsOfExperience: null,
        lastCompany: '',
        jobProfile:'',
        currentCTC:null,
        expectedCTC:null,
        noticePeriod:''
    };
    
    @track candidateId = null;
    isSubmitting = false;
    acceptedFormats = ['.pdf', '.doc', '.docx', '.rtf'];

    positionOptions = [
        { label: 'HR & Marketing Intern', value: 'HR & Marketing Intern' },
        { label: 'Business Analyst', value: 'Business Analyst' },
        { label: 'React Developer', value: 'React Developer' },
        { label: 'UI/UX Freelance', value: 'UI/UX Freelance' },
        { label: 'Content Writer Freelance', value: 'Content Writer Freelance' },
        { label: 'Salesforce Developer Intern', value: 'Salesforce Developer Intern' },
        { label: 'Salesforce Developer (Fresher)', value: 'Salesforce Developer (Fresher)' },
        { label: 'Senior Salesforce Developer', value: 'Senior Salesforce Developer' },
    ];

    @track expYears = '';
    @track expMonths = '0';
    get monthOptions() {
        return [
            { label: '0', value: '0' },
            { label: '1', value: '1' },
            { label: '2', value: '2' },
            { label: '3', value: '3' },
            { label: '4', value: '4' },
            { label: '5', value: '5' },
            { label: '6', value: '6' },
            { label: '7', value: '7' },
            { label: '8', value: '8' },
            { label: '9', value: '9' },
            { label: '10', value: '10' },
            { label: '11', value: '11' },
        ];
    }

    rawCountryData = {};
    rawStateData = [];   
    countryOptions = [];
    currentStateOptions = []; 
    permanentStateOptions = []; 
    currentCountryCode = ''; 
    permanentCountryCode = '';

    @track resumeFileData = null;
    @track resumeFileName = 'None';

    @track payslipFileData = null;
    @track payslipFileName = 'None';

    MAX_FILE_SIZE = 10000000;


    @wire(getObjectInfo, { objectApiName: ACCOUNT_OBJECT })
    accountInfo;

    @wire(getPicklistValues, { recordTypeId: '$accountInfo.data.defaultRecordTypeId', fieldApiName: BILLING_COUNTRY_CODE })
    wiredCountries({ error, data }) {
        if (data) {
            this.rawCountryData = data; 
            this.countryOptions = data.values; 
            
            // ⭐ NEW: Log the first few country options to see the structure ⭐
            console.log('Country Data Structure:', JSON.stringify(data.values.slice(0, 5)));
            
            this.updateStateOptions(this.currentCountryCode, 'current');
            this.updateStateOptions(this.permanentCountryCode, 'permanent');
        } else if (error) {
            console.error('Error fetching countries:', error);
        }
    }
    @wire(getPicklistValues, { recordTypeId: '$accountInfo.data.defaultRecordTypeId', fieldApiName: BILLING_STATE_CODE })
    wiredStates({ error, data }) {
        if (data) {
            console.log('State Data:', JSON.stringify(data));
            this.rawStateData = data; // Storing state data
            this.updateStateOptions(this.currentCountryCode, 'current'); 
            this.updateStateOptions(this.permanentCountryCode, 'permanent');
            

        } else if (error) {
            console.error('Error fetching states:', error);
        }
    }


        updateStateOptions(countryValue, addressType) {
        // 1. Safety Checks
        // We check if rawStateData AND rawStateData.controllerValues exist
        if (!countryValue || !this.rawStateData || !this.rawStateData.controllerValues) {
            if (addressType === 'current') {
                this.currentStateOptions = [];
                this.candidate.currentAddress.province = '';
            }
            if (addressType === 'permanent') {
                this.permanentStateOptions = [];
                this.candidate.permanentAddress.province = '';
            }
            return;
        }
        // 2. GET THE CONTROLLER KEY
        // The API returns a map like: { "US": 5, "IN": 2, "CA": 1 }
        // We pass the Country Code (e.g., "US") to get the key (e.g., 5).
        const key = this.rawStateData.controllerValues[countryValue];
        // 3. Filter the State Values
        // validFor contains the keys. e.g., State 'New York' has validFor: [5]
        const filteredStates = this.rawStateData.values.filter(opt =>
            opt.validFor && opt.validFor.includes(key)
        );
        // 4. Assign to the correct array
        if (addressType === 'current') {
            this.currentStateOptions = filteredStates;
            // Only clear value if the current value is not in the new list
            // (Optional, but good UX to clear it to avoid invalid selections)
             this.candidate.currentAddress.province = '';
        } else if (addressType === 'permanent') {
            this.permanentStateOptions = filteredStates;
             this.candidate.permanentAddress.province = '';
        }
    }

    handleInputChange(event) {
        const field = event.target.name;
        const value = event.target.value;
        const isChecked = event.target.checked;

        if (field === 'expYears' || field === 'expMonths') {
            if (field === 'expYears') this.expYears = value;
            if (field === 'expMonths') this.expMonths = value;
            const y = this.expYears ? this.expYears : '0';
            const m = this.expMonths ? this.expMonths : '0';
            this.candidate.yearsOfExperience = `${y} Years ${m} Months`;
        }
        
        if (field === 'CAddressEqualsPAddress') {
            // 1. Update the state
            this.candidate.CAddressEqualsPAddress = isChecked;

            // 2. If Checked (True) -> We want to HIDE fields.
            if (isChecked) {
                // Clear the data
                this.candidate.permanentAddress = {
                    street: '',
                    city: '',
                    province: '',
                    postalCode: '',
                    country: ''
                };
                
                // CRITICAL FIX: Force clear the validation error so the fields can disappear
                this.forceClearPermanentAddressValidation();
            }
        }
        // Special handling for the Checkbox/Boolean field
        else if (field === 'hasPriorExperience') {
            this.candidate.hasPriorExperience = event.target.checked;
            this.candidate[field] = event.target.checked;

            if (!event.target.checked) {
                this.candidate.yearsOfExperience = null;
                this.candidate.lastCompany = '';
                this.candidate.jobProfile='';
                this.candidate.currentCTC=null;
                this.candidate.expectedCTC=null;
                this.candidate.noticePeriod='';
            }
        } else {
            this.candidate[field] = value;
        }
    }

    

    forceClearPermanentAddressValidation() {
        // We select the fields using the data attribute we added in HTML
        const addressFields = this.template.querySelectorAll('[data-permanent-address="true"]');
        
        addressFields.forEach(field => {
            field.setCustomValidity(''); // Clear custom error message
            field.reportValidity();      // Remove the red border
        });
    }
    
    // Current Address Handler
// Current Address Handler
    handleCurrentAddressChange(event) {
        // Spread syntax to create a new copy of the object (Good practice in LWC)
        this.candidate.currentAddress = { ...event.detail };
        // lightning-input-address returns the ISO Code (e.g., "US", "IN")
        const newCountry = event.detail.country;
        if (newCountry !== this.currentCountryCode) {
            this.currentCountryCode = newCountry;
            this.updateStateOptions(this.currentCountryCode, 'current');
        }
    }

    // Permanent Address Handler (where you used combobox for country)
    handlePermanentAddressChange(event) {
        const field = event.target.name;
        const value = event.target.value;
        
        this.candidate.permanentAddress[field] = value;

        if (field === 'country') { // <-- The fix triggers ONLY when country changes
            this.permanentCountryCode = value;
            
            // ⭐ Calls the dependency logic to filter states ⭐
            this.updateStateOptions(this.permanentCountryCode, 'permanent');
            
            // Clear state field when country changes (good practice)
            this.candidate.permanentAddress.province = '';
        }
    }

    get submitButtonLabel() {
        return this.isSubmitting ? 'Submitting...' : 'Finalize Application';
    }

    // ApplicationForm.js

    handleFileChange(event) {
        const fileInputName = event.target.name; // 'resumeFile' or 'payslipFile'

        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            
            // Basic size validation
            if (file.size > this.MAX_FILE_SIZE) {
                this.showToast('Error', 'File size exceeds the 10MB limit.', 'error');
                event.target.value = ''; // Clear file input
                
                // Clear the corresponding state
                if (fileInputName === 'resumeFile') {
                    this.resumeFileData = null;
                    this.resumeFileName = 'None';
                } else if (fileInputName === 'payslipFile') {
                    this.payslipFileData = null;
                    this.payslipFileName = 'None';
                }
                return;
            }

            // Set the file name for display
            if (fileInputName === 'resumeFile') {
                this.resumeFileName = file.name;
            } else if (fileInputName === 'payslipFile') {
                this.payslipFileName = file.name;
            }

            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                
                // ⭐ Store Base64 data in the correct variable ⭐
                const fileData = { base64: base64, name: file.name };

                if (fileInputName === 'resumeFile') {
                    this.resumeFileData = fileData;
                } else if (fileInputName === 'payslipFile') {
                    this.payslipFileData = fileData;
                }
            };
            reader.readAsDataURL(file);

        } else {
            // Clear data if the user cancels file selection
            if (fileInputName === 'resumeFile') {
                this.resumeFileData = null;
                this.resumeFileName = 'None';
            } else if (fileInputName === 'payslipFile') {
                this.payslipFileData = null;
                this.payslipFileName = 'None';
            }
        }
    }

    async handleSubmit(event) {
        event.preventDefault();
        this.isSubmitting = true;

        if (!this.validateFields()) {
            this.isSubmitting = false;
            console.log('Validation Failed. Stopping submission.');
            return;
        }

        console.log('Validation Passed. Checking Files.');

        if (!this.resumeFileData) {
            this.showToast('Error', 'Please select a resume/CV to upload.', 'error');
            this.isSubmitting = false;
            console.log('Resume File Data Check:', JSON.stringify(this.resumeFileData));
            return;
        }

        const cAdd = this.candidate.currentAddress;
        
        let pAdd = this.candidate.CAddressEqualsPAddress
            ? cAdd 
            : this.candidate.permanentAddress;

        // Determine payslip data (it can be null if the conditional section is hidden or file wasn't selected)
        const payslipBase64 = this.payslipFileData ? this.payslipFileData.base64 : null;
        const payslipName = this.payslipFileData ? this.payslipFileData.name : null;
        console.log('playSlip'+this.payslipFileData);

        console.log('Calling Apex method...');
        
        try {
            const newCandidateId = await submitApplication({
                firstName: this.candidate.firstName,
                lastName: this.candidate.lastName,
                email: this.candidate.email,
                phone: this.candidate.phone,
                positionValue: this.candidate.position, 

                street: cAdd.street,
                city: cAdd.city,
                state: cAdd.province,
                postalCode: cAdd.postalCode,
                country: cAdd.country,
                CAddressEqualsPAddress: this.candidate.CAddressEqualsPAddress,
                permanentStreet: pAdd.street,
                permanentCity: pAdd.city,
                permanentState: pAdd.province,
                permanentPostalCode: pAdd.postalCode,
                permanentCountry: pAdd.country,
                
                // ⭐ RESTORED: Education & Experience Fields ⭐
                highestDegree: this.candidate.highestDegree,
                universityName: this.candidate.universityName,
                graduationYear: this.candidate.graduationYear,
                hasPriorExperience: this.candidate.hasPriorExperience,
                yearsOfExperience: this.candidate.yearsOfExperience,
                lastCompany: this.candidate.lastCompany,
                
                // ⭐ RESTORED: Job Details ⭐
                jobProfile: this.candidate.jobProfile,
                currentCTC: this.candidate.currentCTC,
                expectedCTC: this.candidate.expectedCTC,
                noticePeriodDays: this.candidate.noticePeriodDays,

                // ⭐ FILE DATA (KEEP THESE) ⭐
                resumeBase64: this.resumeFileData.base64,
                resumeFileName: this.resumeFileData.name,
                payslipBase64: payslipBase64,
                payslipFileName: payslipName
            });
           this.candidateId = newCandidateId; // Optional: Set ID if needed for post-submission logic
            this.isSubmitting = false; // Reset loading state
            
            // Display Success Toast
            this.showToast('Application Submitted', `Your application and documents have been successfully submitted.`, 'success');
            
            // Optional: Reload the page after a brief delay for a clean reset
            setTimeout(() => {
                window.location.reload(); 
            }, 3000); 
            
            // --- END RESTORED SUCCESS LOGIC ---
            
        } catch (error) {
            // --- START RESTORED ERROR HANDLING ---
            this.isSubmitting = false; // Reset loading state
            
            let errorMessage = 'An unexpected error occurred during submission.';
            
            // Check for the detailed error message sent back from Apex (AuraHandledException)
            if (error.body && error.body.message) {
                errorMessage = error.body.message;
            } else if (error.message) {
                errorMessage = error.message;
            } else {
                errorMessage = JSON.stringify(error);
            }

            // Display Error Toast
            this.showToast('Error', errorMessage, 'error');
            // --- END RESTORED ERROR HANDLING ---
        } finally {
            this.isSubmitting = false;
        }
    }

    

    validateFields() {
        let isValid = true;
        const inputFields = this.template.querySelectorAll('lightning-input, lightning-combobox, lightning-input-address');
        
        inputFields.forEach(inputField => {
            if(!inputField.checkValidity()) {
                inputField.reportValidity();
                isValid = false;
            }
        });
        return isValid;
    }

    validateNumberInput(event) {
        // 1. Enforce Numeric Input Only (Allows control keys: Backspace, Tab, Delete, Arrows)
        const key = event.key;
        const isNumber = /^[0-9]$/.test(key);
        const isControlKey = event.keyCode === 8 || // Backspace
                            event.keyCode === 9 || // Tab
                            event.keyCode === 46 || // Delete
                            (event.keyCode >= 37 && event.keyCode <= 40); // Arrow keys

        if (!isNumber && !isControlKey) {
            event.preventDefault();
            return;
        }

        const inputElement = event.target;
        const value = inputElement.value;
        
        if (value.length >= 10 && isNumber) {
            event.preventDefault();
        }
    }

    validateYearInput(event) {
        const key = event.key;
        const isNumber = /^[0-9]$/.test(key);
        const isControlKey = event.keyCode === 8 || event.keyCode === 9 || event.keyCode === 46 || (event.keyCode >= 37 && event.keyCode <= 40);

        if (!isNumber && !isControlKey) {
            event.preventDefault();
            return;
        }

        const inputElement = event.target;
        const value = inputElement.value;
        
        if (value.length >= 4 && isNumber) {
            event.preventDefault();
        }

        setTimeout(() => {
            const currentVal = inputElement.value;
            const min = inputElement.min;
            const max = inputElement.max;

            if (currentVal.length === 4) {
                const year = parseInt(currentVal, 10);
                if (min && year < parseInt(min, 10)) {
                    inputElement.setCustomValidity(`Minimum year is ${min}`);
                } else if (max && year > parseInt(max, 10)) {
                    inputElement.setCustomValidity(`Maximum year is ${max}`);
                } else {
                    inputElement.setCustomValidity("");
                }
            } else {
                inputElement.setCustomValidity("");
            }
            inputElement.reportValidity();
        }, 0);
    }

    showToast(title, message, variant) {
        // FIX 2: This relies on the import statement being correct.
        const evt = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
            mode: 'sticky'
        });
        this.dispatchEvent(evt);
    }
}