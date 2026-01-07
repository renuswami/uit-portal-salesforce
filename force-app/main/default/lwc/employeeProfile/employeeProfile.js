import { LightningElement, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';

// Current user
import USER_ID from '@salesforce/user/Id';
import USER_CONTACT_ID from '@salesforce/schema/User.ContactId';
import USER_CREATED_DATE from '@salesforce/schema/User.CreatedDate';
import USER_USER_TYPE from '@salesforce/schema/User.UserType';

// Contact fields
import CONTACT_NAME from '@salesforce/schema/Contact.Name';
import CONTACT_EMAIL from '@salesforce/schema/Contact.Email';
import CONTACT_PHONE from '@salesforce/schema/Contact.Phone';
import CONTACT_DEPARTMENT from '@salesforce/schema/Contact.Department';
import CONTACT_TITLE from '@salesforce/schema/Contact.Title';
import CONTACT_REPORTS_TO_ID from '@salesforce/schema/Contact.ReportsToId';
import CONTACT_MAILING_STREET from '@salesforce/schema/Contact.MailingStreet';
import CONTACT_MAILING_CITY from '@salesforce/schema/Contact.MailingCity';
import CONTACT_MAILING_STATE from '@salesforce/schema/Contact.MailingState';
import CONTACT_MAILING_POSTAL_CODE from '@salesforce/schema/Contact.MailingPostalCode';

export default class EmployeeProfile extends LightningElement {
  // Wires
  @wire(getRecord, {
    recordId: USER_ID,
    fields: [USER_CONTACT_ID, USER_CREATED_DATE, USER_USER_TYPE]
  }) userRecord;

  get contactId() {
    return getFieldValue(this.userRecord?.data, USER_CONTACT_ID);
  }

  @wire(getRecord, {
    recordId: '$contactId',
    fields: [
      CONTACT_NAME,
      CONTACT_EMAIL,
      CONTACT_PHONE,
      CONTACT_DEPARTMENT,
      CONTACT_TITLE,
      CONTACT_REPORTS_TO_ID,
      CONTACT_MAILING_STREET,
      CONTACT_MAILING_CITY,
      CONTACT_MAILING_STATE,
      CONTACT_MAILING_POSTAL_CODE
    ]
  }) contactRecord;

  get managerContactId() {
    return getFieldValue(this.contactRecord?.data, CONTACT_REPORTS_TO_ID);
  }

  @wire(getRecord, {
    recordId: '$managerContactId',
    fields: [CONTACT_NAME, CONTACT_TITLE]
  }) managerRecord;

  // View-model getters
  get employeeData() {
    const name = getFieldValue(this.contactRecord?.data, CONTACT_NAME) || '';
    const designation = getFieldValue(this.contactRecord?.data, CONTACT_TITLE) || '';
    const department = getFieldValue(this.contactRecord?.data, CONTACT_DEPARTMENT) || '';
    const email = getFieldValue(this.contactRecord?.data, CONTACT_EMAIL) || '';
    const phone = getFieldValue(this.contactRecord?.data, CONTACT_PHONE) || '';
    const id = this.contactId || '';
    const employmentType = getFieldValue(this.userRecord?.data, USER_USER_TYPE) || 'Community User';

    const street = getFieldValue(this.contactRecord?.data, CONTACT_MAILING_STREET) || '';
    const city = getFieldValue(this.contactRecord?.data, CONTACT_MAILING_CITY) || '';
    const state = getFieldValue(this.contactRecord?.data, CONTACT_MAILING_STATE) || '';
    const postal = getFieldValue(this.contactRecord?.data, CONTACT_MAILING_POSTAL_CODE) || '';
    const address = [street, city, state].filter(Boolean).join(', ') + (postal ? ` ${postal}` : '');

    const manager = getFieldValue(this.managerRecord?.data, CONTACT_NAME) || '';
    const managerTitle = getFieldValue(this.managerRecord?.data, CONTACT_TITLE) || '';

    const joiningDate = this.joiningDateString;

    return {
      name,
      id,
      department,
      designation,
      joiningDate,
      employmentType,
      email,
      phone,
      address,
      manager,
      managerTitle,
      tenure: this.tenure
    };
  }

  get initials() {
    const name = this.employeeData?.name || '';
    const parts = name.trim().split(' ').filter(Boolean);
    const first = parts[0]?.[0] || '';
    const last = parts[1]?.[0] || '';
    return `${first}${last}`.toUpperCase();
  }

  get joiningDateString() {
    const created = getFieldValue(this.userRecord?.data, USER_CREATED_DATE);
    if (!created) return '';
    try {
      const d = new Date(created);
      return d.toLocaleDateString();
    } catch (e) {
      return '';
    }
  }

  get tenure() {
    const created = getFieldValue(this.userRecord?.data, USER_CREATED_DATE);
    if (!created) return { years: 0, months: 0, days: 0 };
    const start = new Date(created);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    const remDays = Math.max(0, days - years * 365 - months * 30);
    return { years, months, days: remDays };
  }

  get tenureString() {
    const { years, months, days } = this.tenure || { years: 0, months: 0, days: 0 };
    return `${years} years, ${months} months, ${days} days`;
  }
}