import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ALL_SCHEMAS } from '../data/schemas.data';
import { FormSchema } from '../models/schema.models';

/**
 * Mocks: GET /api/schemas -> returns both schemas.
 * No real HttpClient/network call is made; kept as an injectable service so it
 * could be swapped for a real HttpClient-backed implementation without touching callers.
 */
@Injectable({ providedIn: 'root' })
export class SchemaApiService {
  getSchemas(): Observable<FormSchema[]> {
    return of(ALL_SCHEMAS).pipe(delay(250));
  }
}
