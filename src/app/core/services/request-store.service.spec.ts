import { TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { Observable, defer, throwError, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { RequestStoreService } from './request-store.service';
import { RequestApiService, SaveAnswerResponse } from './request-api.service';
import { HARDWARE_REQUEST_SCHEMA, SOFTWARE_REQUEST_SCHEMA } from '../data/schemas.data';

const DEBOUNCE_MS = 700;
const API_LATENCY_MS = 100;

function okResponse(questionId: number, value: unknown): Observable<SaveAnswerResponse> {
  return timer(API_LATENCY_MS).pipe(map(() => ({ requestId: 'r', questionId, value, savedAt: '' })));
}

describe('RequestStoreService', () => {
  let store: RequestStoreService;
  let api: jasmine.SpyObj<RequestApiService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<RequestApiService>('RequestApiService', ['saveAnswer']);
    api.saveAnswer.and.callFake((_reqId, questionId, value) => okResponse(questionId, value));

    TestBed.configureTestingModule({
      providers: [{ provide: RequestApiService, useValue: api }],
    });
    store = TestBed.inject(RequestStoreService);
    store.selectSchema(SOFTWARE_REQUEST_SCHEMA);
  });

  it('seeds toggle defaults when a schema is selected', () => {
    store.selectSchema(HARDWARE_REQUEST_SCHEMA);
    const toggle = HARDWARE_REQUEST_SCHEMA.sections[0].fields.find((f) => f.type === 'toggle')!;

    expect(store.answers()[toggle.id]).toBeFalse();
    expect(store.requestId()).toBeTruthy();
  });

  it('updates answers immediately but debounces the API call per question', fakeAsync(() => {
    store.queueAnswer(1, 'a');
    store.queueAnswer(1, 'ab');
    store.queueAnswer(1, 'abc');

    expect(store.answers()[1]).toBe('abc');
    expect(api.saveAnswer).not.toHaveBeenCalled();

    tick(DEBOUNCE_MS);
    expect(api.saveAnswer).toHaveBeenCalledOnceWith(jasmine.any(String), 1, 'abc');
    expect(store.saveStatus()[1]).toBe('saving');
    expect(store.isAnySaving()).toBeTrue();

    tick(API_LATENCY_MS);
    expect(store.saveStatus()[1]).toBe('saved');
    expect(store.isAnySaving()).toBeFalse();
  }));

  it('saves different questions independently (one field does not cancel another)', fakeAsync(() => {
    store.queueAnswer(1, 'item');
    tick(300);
    store.queueAnswer(2, 5);

    tick(DEBOUNCE_MS + API_LATENCY_MS);

    expect(api.saveAnswer).toHaveBeenCalledWith(jasmine.any(String), 1, 'item');
    expect(api.saveAnswer).toHaveBeenCalledWith(jasmine.any(String), 2, 5);
    expect(store.saveStatus()[1]).toBe('saved');
    expect(store.saveStatus()[2]).toBe('saved');
  }));

  it('skips the call when the debounced value did not change', fakeAsync(() => {
    store.queueAnswer(1, 'same');
    tick(DEBOUNCE_MS + API_LATENCY_MS);
    store.queueAnswer(1, 'same');
    tick(DEBOUNCE_MS + API_LATENCY_MS);

    expect(api.saveAnswer).toHaveBeenCalledTimes(1);
  }));

  it('shows "retrying" and recovers when a retry succeeds', fakeAsync(() => {
    let attempts = 0;
    api.saveAnswer.and.callFake((_reqId, questionId, value) =>
      defer(() => (++attempts === 1 ? throwError(() => new Error('boom')) : okResponse(questionId, value))),
    );

    store.queueAnswer(1, 'x');
    tick(DEBOUNCE_MS);
    expect(store.saveStatus()[1]).toBe('retrying');

    tick(300 + API_LATENCY_MS);
    expect(attempts).toBe(2);
    expect(store.saveStatus()[1]).toBe('saved');
  }));

  it('gives up after 2 retries, flags an error and allows a manual retry', fakeAsync(() => {
    let attempts = 0;
    api.saveAnswer.and.callFake(() =>
      defer(() => {
        attempts++;
        return throwError(() => new Error('boom'));
      }),
    );

    store.queueAnswer(1, 'x');
    tick(DEBOUNCE_MS + 300 + 600);

    expect(attempts).toBe(3); // 1 attempt + 2 retries
    expect(store.saveStatus()[1]).toBe('error');

    api.saveAnswer.and.callFake((_reqId, questionId, value) => okResponse(questionId, value));
    store.retrySave(1);
    tick(DEBOUNCE_MS + API_LATENCY_MS);

    expect(store.saveStatus()[1]).toBe('saved');
    discardPeriodicTasks();
  }));

  it('reset() clears the active request', () => {
    store.queueAnswer(1, 'x');
    store.reset();

    expect(store.schema()).toBeNull();
    expect(store.requestId()).toBeNull();
    expect(store.answers()).toEqual({});
  });

  it('drops a pending change when the request is reset before the debounce fires', fakeAsync(() => {
    store.queueAnswer(1, 'x');
    store.reset();
    tick(DEBOUNCE_MS);

    expect(api.saveAnswer).not.toHaveBeenCalled();
    expect(store.saveStatus()[1]).toBeUndefined();
  }));

  it('never saves a stale change under a newer request id', fakeAsync(() => {
    store.queueAnswer(1, 'old');
    store.selectSchema(SOFTWARE_REQUEST_SCHEMA); // new request id
    tick(DEBOUNCE_MS + API_LATENCY_MS);

    expect(api.saveAnswer).not.toHaveBeenCalled();
  }));
});
