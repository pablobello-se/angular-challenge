import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RequestStoreService } from '../../core/services/request-store.service';
import { FieldSchema } from '../../core/models/schema.models';

@Component({
  selector: 'app-request-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './request-summary.component.html',
  styleUrl: './request-summary.component.scss',
})
export class RequestSummaryComponent implements OnInit {
  readonly schema;
  readonly answers;
  readonly requestId;

  constructor(
    private readonly store: RequestStoreService,
    private readonly router: Router,
  ) {
    this.schema = this.store.schema;
    this.answers = this.store.answers;
    this.requestId = this.store.requestId;
  }

  ngOnInit(): void {
    if (!this.schema()) {
      this.router.navigate(['/']);
    }
  }

  /** Returns null for unanswered fields so the template can render the "not answered" placeholder. */
  displayValue(field: FieldSchema): string | null {
    const value = this.answers()[field.id];

    if (field.type === 'toggle') {
      return value ? 'Yes' : 'No';
    }
    if (value === undefined || value === null || value === '') {
      return null;
    }
    return String(value);
  }

  createNewRequest(): void {
    this.store.reset();
    this.router.navigate(['/']);
  }
}
