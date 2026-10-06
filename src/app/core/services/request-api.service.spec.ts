import { fakeAsync, tick } from '@angular/core/testing';
import { RequestApiService } from './request-api.service';

describe('RequestApiService (mock PUT)', () => {
  const service = new RequestApiService();

  it('resolves after the simulated 600-1000ms latency', fakeAsync(() => {
    // 1st random -> latency (0.5 => 800ms), 2nd random -> failure roll (0.9 => success)
    spyOn(Math, 'random').and.returnValues(0.5, 0.9);
    let result: unknown;

    service.saveAnswer('req-1', 42, 'value').subscribe((res) => (result = res));

    tick(799);
    expect(result).toBeUndefined();
    tick(1);
    expect(result).toEqual(jasmine.objectContaining({ requestId: 'req-1', questionId: 42, value: 'value' }));
  }));

  it('fails when the random roll falls inside the failure rate', fakeAsync(() => {
    spyOn(Math, 'random').and.returnValues(0, 0.01);
    let error: Error | undefined;

    service.saveAnswer('req-1', 42, 'value').subscribe({ error: (err: Error) => (error = err) });
    tick(600);

    expect(error?.message).toContain('/api/requests/req-1/question/42');
  }));
});
