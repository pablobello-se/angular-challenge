import { Injectable } from '@angular/core';
import { Observable, throwError, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

export interface SaveAnswerResponse {
  requestId: string;
  questionId: number;
  value: unknown;
  savedAt: string;
}

const MIN_LATENCY_MS = 600;
const MAX_LATENCY_MS = 1000;
const FAILURE_RATE = 0.15; // 10-20% band per spec

/**
 * Mocks: PUT /api/requests/:id/question/:questionId
 * Simulates 600-1000ms latency and a 10-20% random failure rate so the
 * autosave error/retry UX in RequestStoreService has something to exercise.
 */
@Injectable({ providedIn: 'root' })
export class RequestApiService {
  saveAnswer(requestId: string, questionId: number, value: unknown): Observable<SaveAnswerResponse> {
    const latency = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);

    return timer(latency).pipe(
      switchMap(() => {
        if (Math.random() < FAILURE_RATE) {
          return throwError(() => new Error(`Mock PUT /api/requests/${requestId}/question/${questionId} failed`));
        }
        return timer(0).pipe(
          map(() => ({
            requestId,
            questionId,
            value,
            savedAt: new Date().toISOString(),
          })),
        );
      }),
    );
  }
}
