import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, NEVER } from 'rxjs';
import { SOFTWARE_REQUEST_SCHEMA } from '../../core/data/schemas.data';
import { RequestApiService } from '../../core/services/request-api.service';
import { RequestStoreService } from '../../core/services/request-store.service';
import { RequestFormComponent } from './request-form.component';

describe('RequestFormComponent', () => {
  let fixture: ComponentFixture<RequestFormComponent>;
  let component: RequestFormComponent;
  let router: Router;
  let params$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const [requestedItem, vendorInfo] = SOFTWARE_REQUEST_SCHEMA.sections;

  function setSection(index: number): void {
    params$.next(convertToParamMap({ schemaId: SOFTWARE_REQUEST_SCHEMA.id, sectionIndex: String(index) }));
    fixture.detectChanges();
  }

  function submitButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button[type="submit"]');
  }

  beforeEach(() => {
    params$ = new BehaviorSubject(convertToParamMap({ schemaId: SOFTWARE_REQUEST_SCHEMA.id, sectionIndex: '0' }));

    TestBed.configureTestingModule({
      imports: [RequestFormComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params$ } },
        // Autosave is covered in the store spec; keep the API silent here.
        { provide: RequestApiService, useValue: { saveAnswer: () => NEVER } },
      ],
    });

    TestBed.inject(RequestStoreService).selectSchema(SOFTWARE_REQUEST_SCHEMA);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(RequestFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('builds one control per field of the current section', () => {
    expect(Object.keys(component.form.controls)).toEqual(requestedItem.fields.map((f) => String(f.id)));
  });

  it('blocks "Next" and highlights errors while the section is invalid', () => {
    expect(submitButton().getAttribute('aria-disabled')).toBe('true');

    submitButton().click();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(router.navigate).not.toHaveBeenCalled();
    expect(el.querySelectorAll('.field--invalid').length).toBe(2);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('fix the highlighted fields');
    expect(document.activeElement).toBe(el.querySelector('.field--invalid input'));
  });

  it('unblocks "Next" as soon as the section becomes valid', () => {
    for (const field of requestedItem.fields) {
      component.form.get(String(field.id))!.setValue(field.type === 'number' ? 3 : 'Figma');
    }
    fixture.detectChanges();

    expect(submitButton().getAttribute('aria-disabled')).toBe('false');
  });

  it('flags a non-numeric quantity as invalid', () => {
    const quantity = requestedItem.fields.find((f) => f.type === 'number')!;
    component.form.get(String(quantity.id))!.setValue('abc');

    expect(component.form.get(String(quantity.id))!.hasError('number')).toBeTrue();
  });

  it('moves to the next section once the section is valid', () => {
    for (const field of requestedItem.fields) {
      component.form.get(String(field.id))!.setValue(field.type === 'number' ? 3 : 'Figma');
    }
    submitButton().click();

    expect(router.navigate).toHaveBeenCalledWith(['/request', SOFTWARE_REQUEST_SCHEMA.id, 'section', 1]);
  });

  it('shows "Submit" and "Previous" on the last section and restores saved answers', () => {
    const itemName = requestedItem.fields[0];
    TestBed.inject(RequestStoreService).queueAnswer(itemName.id, 'Figma');

    setSection(1);
    expect(submitButton().textContent).toContain('Submit');
    expect(fixture.nativeElement.textContent).toContain('Previous');
    expect(Object.keys(component.form.controls)).toEqual(vendorInfo.fields.map((f) => String(f.id)));

    setSection(0);
    expect(component.form.get(String(itemName.id))!.value).toBe('Figma');
  });

  it('goes to the summary on a valid submit', () => {
    setSection(1);
    for (const field of vendorInfo.fields) {
      component.form.get(String(field.id))!.setValue(field.type === 'radio' ? field.options![0] : 'Acme');
    }
    submitButton().click();

    expect(router.navigate).toHaveBeenCalledWith(['/request', SOFTWARE_REQUEST_SCHEMA.id, 'summary']);
  });
});
