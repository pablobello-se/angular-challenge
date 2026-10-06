import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FieldSchema, SaveStatus } from '../../../core/models/schema.models';
import { SaveIndicatorComponent } from '../save-indicator/save-indicator.component';

@Component({
  selector: 'app-dynamic-field',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SaveIndicatorComponent],
  templateUrl: './dynamic-field.component.html',
  styleUrl: './dynamic-field.component.scss',
})
export class DynamicFieldComponent {
  @Input({ required: true }) field!: FieldSchema;
  @Input({ required: true }) control!: FormControl;
  @Input() saveStatus?: SaveStatus;
  @Input() forceShowErrors = false;
  @Output() retry = new EventEmitter<void>();

  get showError(): boolean {
    return this.control.invalid && (this.control.touched || this.forceShowErrors);
  }

  get errorMessage(): string {
    if (this.control.errors?.['required']) {
      return `${this.field.label} is required.`;
    }
    if (this.control.errors?.['number']) {
      return `${this.field.label} must be a number.`;
    }
    return 'This field is invalid.';
  }
}
