import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';
import { RequestSummaryComponent } from './request-summary.component';
import { RequestStoreService } from '../../core/services/request-store.service';
import { RequestApiService } from '../../core/services/request-api.service';
import { HARDWARE_REQUEST_SCHEMA } from '../../core/data/schemas.data';

describe('RequestSummaryComponent', () => {
  let store: RequestStoreService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RequestSummaryComponent],
      providers: [provideRouter([]), { provide: RequestApiService, useValue: { saveAnswer: () => NEVER } }],
    });
    store = TestBed.inject(RequestStoreService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  it('lists every answer read-only, with placeholders for unanswered fields', () => {
    store.selectSchema(HARDWARE_REQUEST_SCHEMA);
    const [itemName] = HARDWARE_REQUEST_SCHEMA.sections[0].fields;
    store.queueAnswer(itemName.id, 'Laptop');

    const fixture = TestBed.createComponent(RequestSummaryComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const totalFields = HARDWARE_REQUEST_SCHEMA.sections.reduce((n, s) => n + s.fields.length, 0);
    expect(el.querySelectorAll('.summary__row').length).toBe(totalFields);
    expect(el.textContent).toContain('Laptop');
    expect(el.textContent).toContain('not answered');
    expect(el.querySelectorAll('input').length).toBe(0);
  });

  it('"Create New Request" resets the store and returns to the chooser', () => {
    store.selectSchema(HARDWARE_REQUEST_SCHEMA);
    const fixture = TestBed.createComponent(RequestSummaryComponent);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.summary__cta') as HTMLButtonElement).click();

    expect(store.schema()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('redirects to the chooser when there is no active request (e.g. page refresh)', () => {
    TestBed.createComponent(RequestSummaryComponent).detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
