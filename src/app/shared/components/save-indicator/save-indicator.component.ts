import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SaveStatus } from '../../../core/models/schema.models';

@Component({
  selector: 'app-save-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './save-indicator.component.html',
  styleUrl: './save-indicator.component.scss',
})
export class SaveIndicatorComponent {
  @Input() status?: SaveStatus;
  @Output() retry = new EventEmitter<void>();

  get label(): string {
    switch (this.status) {
      case 'saving':
        return 'Saving…';
      case 'retrying':
        return 'Error – retrying…';
      case 'saved':
        return 'Saved';
      case 'error':
        return 'Error – could not save';
      default:
        return '';
    }
  }
}
