import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { DynamicFieldComponent } from './dynamic-field.component';
import { FieldSchema } from '../../../core/models/schema.models';

describe('DynamicFieldComponent', () => {
  let fixture: ComponentFixture<DynamicFieldComponent>;

  function render(field: FieldSchema, control: FormControl, forceShowErrors = false): HTMLElement {
    fixture = TestBed.createComponent(DynamicFieldComponent);
    fixture.componentRef.setInput('field', field);
    fixture.componentRef.setInput('control', control);
    fixture.componentRef.setInput('forceShowErrors', forceShowErrors);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [DynamicFieldComponent] }));

  it('renders a text input bound to the control', () => {
    const control = new FormControl('hello');
    const el = render({ id: 1, label: 'Item Name', type: 'text' }, control);

    const input = el.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.value).toBe('hello');

    input.value = 'world';
    input.dispatchEvent(new Event('input'));
    expect(control.value).toBe('world');
  });

  it('renders one pill per radio option', () => {
    const el = render(
      { id: 2, label: 'Vendor Location', type: 'radio', options: ['USA', 'UK', 'Other'] },
      new FormControl(''),
    );

    expect(el.querySelectorAll('input[type="radio"]').length).toBe(3);
  });

  it('renders a toggle as a switch', () => {
    const el = render({ id: 3, label: 'Requires shipping', type: 'toggle' }, new FormControl(false));

    expect(el.querySelector('input[role="switch"]')).not.toBeNull();
  });

  it('hides errors on a pristine field', () => {
    const el = render(
      { id: 1, label: 'Item Name', type: 'text', required: true },
      new FormControl('', Validators.required),
    );

    expect(el.querySelector('.field__error')).toBeNull();
  });

  it('highlights a required field when errors are forced (Next/Submit pressed)', () => {
    const el = render(
      { id: 1, label: 'Item Name', type: 'text', required: true },
      new FormControl('', Validators.required),
      true,
    );

    expect(el.querySelector('.field--invalid')).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.field__error')).nativeElement.textContent).toContain(
      'Item Name is required.',
    );
  });
});
