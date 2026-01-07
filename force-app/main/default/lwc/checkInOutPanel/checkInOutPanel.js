import { LightningElement, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getCurrentSession from '@salesforce/apex/WorkSessionController.getCurrentSession';
import checkIn from '@salesforce/apex/WorkSessionController.checkIn';
import checkOut from '@salesforce/apex/WorkSessionController.checkOut';
import getAvailableAccounts from '@salesforce/apex/WorkSessionController.getAvailableAccounts';
import getTodaySessionHours from '@salesforce/apex/WorkSessionController.getTodaySessionHours';

export default class CheckInOutPanel extends LightningElement {
    @track currentSession = null;
    @track isCheckedIn = false;
    @track todayTotalHours = 0;
    @track todayAttendanceHours = 0;
    @track isLoading = false;
    @track currentSessionDuration = { hours: 0, minutes: 0, seconds: 0 };
    @track showWarningModal = false;
    pendingCheckOutData = null;
    
    // Camera properties
    @track showCamera = false;
    @track cameraActive = false;
    @track capturedPhoto = null;
    @track actionType = '';
    cameraStream = null;
    
    // New properties for account selection
    @track availableAccounts = [];
    @track selectedAccountId = null;
    wiredAccountsResult;

    uiTimer;
    wiredCurrentSessionResult;
    wiredTodayHoursResult;

    // --- LIFECYCLE HOOKS ---
    connectedCallback() {
        this.startUiTimer();
    }

    disconnectedCallback() {
        this.stopUiTimer();
        this.stopCamera();
    }

        @wire(getCurrentSession)
wiredSession(result) {
        this.isLoading = true;
    this.wiredCurrentSessionResult = result;

        if (result.data) {
            this.currentSession = result.data;
            this.isCheckedIn = result.data !== null;   
        } else {
            this.currentSession = null;
            this.isCheckedIn = false;                 
        }
        this.isLoading = false;
}

  
    
    @wire(getAvailableAccounts)
    wiredAccounts(result) {
        this.wiredAccountsResult = result;
        if (result.data) {
            this.availableAccounts = result.data;
            // If there's only one account, pre-select it
            if (this.availableAccounts.length === 1) {
                this.selectedAccountId = this.availableAccounts[0].Id;
            }
        } else if (result.error) {
            this.showToast('Error', 'Could not load available accounts.', 'error');
        }
    }

    // --- GETTERS FOR DYNAMIC UI ---
    get checkInButtonDisabled() { return this.isLoading || this.isCheckedIn; }
    get checkOutButtonDisabled() { return this.isLoading || !this.isCheckedIn; }

    get currentSessionInfo() {
        if (!this.isCheckedIn || !this.currentSession) return 'You are not currently checked in.';
        const { hours, minutes } = this.currentSessionDuration;
        const formattedTime = new Date(this.currentSession.Check_In__c).toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' });
        
        let info = `Checked in for ${hours}h ${minutes}m since ${formattedTime}`;
        if(this.currentSession.Account__r) {
            info += ` at ${this.currentSession.Account__r.Name}`;
        }
        return info;
    }

    get formattedTodayHours() {
        let totalMs = (this.todayTotalHours || 0) * 3600000;
        if (this.isCheckedIn && this.currentSession?.Check_In__c) {
            let sessionDurationMs = new Date().getTime() - new Date(this.currentSession.Check_In__c).getTime();
            totalMs += sessionDurationMs;
        }
        return (totalMs / 3600000).toFixed(2);
    }
    
    get statusBadgeText() { return this.isCheckedIn ? 'Checked In' : 'Not Checked In'; }
    get statusBadgeClass() { return `slds-badge slds-m-top_x-small ${this.isCheckedIn ? 'slds-theme_success' : ''}`; }
    get confirmButtonLabel() { return `Confirm & ${this.actionType}`; }
    get modalHeader() { return this.showWarningModal ? 'Warning' : `Take Photo for ${this.actionType}`; }
    
    get accountOptions() {
        return this.availableAccounts.map(acc => ({ label: acc.Name, value: acc.Id }));
    }

    get showAccountSelector() {
        return !this.isCheckedIn && this.availableAccounts.length > 1;
    }
    
    get isConfirmDisabled() {
        if (this.showAccountSelector && !this.selectedAccountId) {
            return true;
        }
        return false;
    }

    // --- EVENT HANDLERS ---
    handleAccountChange(event) {
        this.selectedAccountId = event.detail.value;
    }

    // --- UI TIMER ---
    startUiTimer() {
        this.stopUiTimer();
        this.uiTimer = setInterval(() => {
            if (this.isCheckedIn && this.currentSession?.Check_In__c) {
                const diffMs = new Date().getTime() - new Date(this.currentSession.Check_In__c).getTime();
                let totalSeconds = Math.floor(diffMs / 1000);
                this.currentSessionDuration = {
                    hours: Math.floor(totalSeconds / 3600),
                    minutes: Math.floor((totalSeconds % 3600) / 60),
                    seconds: totalSeconds % 60
                };
            }
        }, 1000);
    }

    stopUiTimer() {
        if (this.uiTimer) {
            clearInterval(this.uiTimer);
        }
    }
    
    // --- CAMERA MODAL & ACTIONS ---
    showCameraModal() {
        this.actionType = this.isCheckedIn ? 'Check Out' : 'Check In';
        this.showCamera = true;
        this.capturedPhoto = null;
        setTimeout(() => this.startCamera(), 200);
    }

    closeCameraModal() {
        this.stopCamera();
        this.showCamera = false;
        this.cameraActive = false;
        this.capturedPhoto = null;
        this.actionType = '';
    }

    async startCamera() {
        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            this.cameraActive = true;
            setTimeout(() => {
                const videoElement = this.template.querySelector('[data-id="videoElement"]');
                if (videoElement) videoElement.srcObject = this.cameraStream;
            }, 100);
        } catch (error) {
            this.showToast('Error', 'Camera access denied or not available.', 'error');
            this.closeCameraModal();
        }
    }

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        this.cameraActive = false;
    }

    capturePhoto() {
        const video = this.template.querySelector('[data-id="videoElement"]');
        if (!video) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        this.capturedPhoto = canvas.toDataURL('image/jpeg');
        this.stopCamera();
    }

    retakePhoto() {
        this.capturedPhoto = null;
        this.startCamera();
    }
    
   /* async confirmAction() {
        if (!this.capturedPhoto) return;
        if (!this.isCheckedIn && this.availableAccounts.length > 0 && !this.selectedAccountId) {
            this.showToast('Required', 'Please select an account before checking in.', 'error');
            return;
        }

        this.isLoading = true;
        const base64Data = this.capturedPhoto.split(',')[1];
        
        try {
            if (this.actionType === 'Check In') {
                await checkIn({ accountId: this.selectedAccountId, photoBase64: base64Data });
            } else {
                await checkOut({ photoBase64: base64Data });
            }
            this.showToast('Success', `${this.actionType} successful!`, 'success');
            this.closeCameraModal();
            await Promise.all([
                refreshApex(this.wiredCurrentSessionResult), 
                refreshApex(this.wiredTodayHoursResult),
                refreshApex(this.wiredAccountsResult)
            ]);
        } catch (error) {
            this.showToast('Error', error.body?.message || 'An unknown error occurred.', 'error');
        } finally {
            this.isLoading = false;
        }
    } */
// LWC method to fetch public IP
// inside your LWC class
async fetchClientIp() {
    const url = 'https://api4.ipify.org?format=json';
    try {
        // timeout helper
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

        const resp = await fetch(url, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);

        if (!resp.ok) {
            console.error('IP service not OK:', resp.status);
            return null;
        }
        const data = await resp.json();
        console.log('Client IP fetched:', data.ip);
        return data.ip;
    } catch (err) {
        if (err.name === 'AbortError') {
            console.error('IP fetch timeout');
        } else {
            console.error('Error fetching client IP:', err);
        }
        // Show friendly toast to user that IP fetch failed due to CSP or network.
        this.showToast(
            'IP Fetch Failed',
            'Could not determine your public IP. Please ensure the domain is allowed in CSP Trusted Sites, or try again.',
            'error'
        );
        return null;
    }
}

proceedCheckoutAfterWarning() {
    this.showWarningModal = false;
    if (!this.pendingCheckOutData) return;
    const { base64Data, clientIp } = this.pendingCheckOutData;
    this.pendingCheckOutData = null;
    this.isLoading = true;
    checkOut({ photoBase64: base64Data, clientIp })
        .then(() => {
            this.showToast('Success', 'Check Out successful!', 'success');
            this.closeCameraModal();
            return Promise.all([
                refreshApex(this.wiredCurrentSessionResult),
                refreshApex(this.wiredTodayHoursResult),
                refreshApex(this.wiredAccountsResult)
            ]);
        })
        .catch(error => {
            this.showToast('Error', error.body?.message || 'An unknown error occurred.', 'error');
        })
        .finally(() => {
            this.isLoading = false;
        });
}


async confirmAction() {
    if (!this.capturedPhoto) return;

    if (!this.isCheckedIn && this.availableAccounts.length > 0 && !this.selectedAccountId) {
        this.showToast('Required', 'Please select an account before checking in.', 'error');
        return;
    }

    this.isLoading = true;

    const base64Data = this.capturedPhoto.split(',')[1];
    const clientIp = await this.fetchClientIp();   // 🔥 Get IP here

        try {
            if (this.actionType === 'Check In') {
                await checkIn({
                    accountId: this.selectedAccountId,
                    photoBase64: base64Data,
                    clientIp: clientIp
                });
            } else {
                const totalHours = await getTodaySessionHours();
                const totalMinutes = Math.round((Number(totalHours) || 0) * 60);
                const thresholdMinutes = 8 * 60;
                console.log('Total Minutes:', totalMinutes);
                console.log('Threshold Minutes:', thresholdMinutes);
                if (totalMinutes < thresholdMinutes) {
                    this.pendingCheckOutData = { base64Data, clientIp };
                    this.showWarningModal = true;
                    this.isLoading = false;
                    return;
                }
                await checkOut({
                    photoBase64: base64Data,
                    clientIp: clientIp
                });
            }

        this.showToast('Success', `${this.actionType} successful!`, 'success');
        this.closeCameraModal();

        await Promise.all([
            refreshApex(this.wiredCurrentSessionResult),
            refreshApex(this.wiredTodayHoursResult),
            refreshApex(this.wiredAccountsResult)
        ]);

    } catch (error) {
        this.showToast('Error', error.body?.message || 'An unknown error occurred.', 'error');
    } finally {
        this.isLoading = false;
    }
}



    // --- UTILITY ---
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}