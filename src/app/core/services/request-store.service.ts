import { Injectable, computed, signal } from '@angular/core';
import { Subject, timer } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, groupBy, mergeMap, of, retry, switchMap, tap } from 'rxjs';
import { RequestApiService } from './request-api.service';
import { FormSchema, SaveStatus } from '../models/schema.models';

interface AnswerChange {
  /** Request the change belongs to, captured when queued so a stale debounce can't leak into a newer request. */
  requestId: string | null;
  questionId: number;
  value: unknown;
  /** Manual retries resend the same value, so they must bypass the distinct-value filter. */
  force?: boolean;
}

const AUTOSAVE_DEBOUNCE_MS = 700;

@Injectable({ providedIn: 'root' })
export class RequestStoreService {
  private readonly _schema = signal<FormSchema | null>(null);
  private readonly _requestId = signal<string | null>(null);
  private readonly _answers = signal<Record<number, unknown>>({});
  private readonly _saveStatus = signal<Record<number, SaveStatus>>({});
  private readonly _currentSectionIndex = signal(0);

  readonly schema = this._schema.asReadonly();
  readonly requestId = this._requestId.asReadonly();
  readonly answers = this._answers.asReadonly();
  readonly saveStatus = this._saveStatus.asReadonly();
  readonly currentSectionIndex = this._currentSectionIndex.asReadonly();

  readonly isAnySaving = computed(() =>
    Object.values(this._saveStatus()).some((status) => status === 'saving' || status === 'retrying'),
  );

  private readonly answerChanges$ = new Subject<AnswerChange>();

  constructor(private readonly api: RequestApiService) {
    this.answerChanges$
      .pipe(
        groupBy((change) => change.questionId),
        mergeMap((group$) =>
          group$.pipe(
            debounceTime(AUTOSAVE_DEBOUNCE_MS),
            distinctUntilChanged(
              (a, b) => !b.force && a.requestId === b.requestId && JSON.stringify(a.value) === JSON.stringify(b.value),
            ),
            switchMap((change) => {
              const reqId = change.requestId;
              // Request was reset or replaced while this change sat in the debounce window: drop it.
              if (!reqId || reqId !== this._requestId()) return of(null);
              this.setStatus(change.questionId, 'saving');
              return this.api.saveAnswer(reqId, change.questionId, change.value).pipe(
                retry({
                  count: 2,
                  delay: (_error, retryCount) => {
                    this.setStatus(change.questionId, 'retrying');
                    return timer(300 * retryCount);
                  },
                }),
                tap(() => this.setStatus(change.questionId, 'saved')),
                catchError(() => {
                  this.setStatus(change.questionId, 'error');
                  return of(null);
                }),
              );
            }),
          ),
        ),
      )
      .subscribe();
  }

  selectSchema(schema: FormSchema): void {
    this._schema.set(schema);
    this._requestId.set(this.generateRequestId());
    this._answers.set(this.buildDefaultAnswers(schema));
    this._saveStatus.set({});
    this._currentSectionIndex.set(0);
  }

  reset(): void {
    this._schema.set(null);
    this._requestId.set(null);
    this._answers.set({});
    this._saveStatus.set({});
    this._currentSectionIndex.set(0);
  }

  goToSection(index: number): void {
    this._currentSectionIndex.set(index);
  }

  /** Updates local state immediately (so UI/summary stay in sync) and queues a debounced autosave call. */
  queueAnswer(questionId: number, value: unknown): void {
    this._answers.update((answers) => ({ ...answers, [questionId]: value }));
    this.answerChanges$.next({ requestId: this._requestId(), questionId, value });
  }

  /** Lets the UI manually re-trigger a save after it has permanently failed. */
  retrySave(questionId: number): void {
    const value = this._answers()[questionId];
    this.answerChanges$.next({ requestId: this._requestId(), questionId, value, force: true });
  }

  private setStatus(questionId: number, status: SaveStatus): void {
    this._saveStatus.update((statuses) => ({ ...statuses, [questionId]: status }));
  }

  private buildDefaultAnswers(schema: FormSchema): Record<number, unknown> {
    const answers: Record<number, unknown> = {};
    for (const section of schema.sections) {
      for (const field of section.fields) {
        if (field.type === 'toggle') {
          answers[field.id] = field.default ?? false;
        }
      }
    }
    return answers;
  }

  private generateRequestId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
