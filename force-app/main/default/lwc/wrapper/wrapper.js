import { LightningElement, api } from 'lwc';

export default class WrapperComponent extends LightningElement {
    // expose to page / Experience Builder
    @api submitButtonControl = false;
}