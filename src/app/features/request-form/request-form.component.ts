import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  ReactiveFormsModule,
  UntypedFormControl,
  UntypedFormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FieldSchema, FormSchema, SaveStatus, SectionSchema } from '../../core/models/schema.models';
import { RequestStoreService } from '../../core/services/request-store.service';
import { SchemaApiService } from '../../core/services/schema-api.service';
import { DynamicFieldComponent } from '../../shared/components/dynamic-field/dynamic-field.component';

function numberValidator(): ValidatorFn {
  return (control): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    return Number.isNaN(Number(value)) ? { number: true } : null;
  };
}

@Component({
  selector: 'app-request-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, DynamicFieldComponent],
  templateUrl: './request-form.component.html',
  styleUrl: './request-form.component.scss',
})
export class RequestFormComponent implements OnInit {
  readonly schema = signal<FormSchema | null>(null);
  readonly section = signal<SectionSchema | null>(null);
  readonly sectionIndex = signal(0);
  readonly forceShowErrors = signal(false);
  form = new UntypedFormGroup({});

  private readonly destroyRef = inject(DestroyRef);

  get isLastSection(): boolean {
    const schema = this.schema();
    return !!schema && this.sectionIndex() === schema.sections.length - 1;
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly schemaApi: SchemaApiService,
    private readonly storeService: RequestStoreService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const schemaId = params.get('schemaId')!;
      const sectionIndex = Number(params.get('sectionIndex') ?? 0);
      this.loadSection(schemaId, sectionIndex);
    });
  }

  private loadSection(schemaId: string, sectionIndex: number): void {
    const activeSchema = this.storeService.schema();

    if (!activeSchema || activeSchema.id !== schemaId) {
      // Deep link / page refresh: rehydrate the schema before rendering.
      this.schemaApi.getSchemas().subscribe((schemas) => {
        const found = schemas.find((s) => s.id === schemaId);
        if (!found) {
          this.router.navigate(['/']);
          return;
        }
        this.storeService.selectSchema(found);
        this.setSection(found, sectionIndex);
      });
      return;
    }

    this.setSection(activeSchema, sectionIndex);
  }

  private setSection(schema: FormSchema, sectionIndex: number): void {
    const section = schema.sections[sectionIndex];
    if (!section) {
      this.router.navigate(['/request', schema.id, 'section', 0]);
      return;
    }

    this.schema.set(schema);
    this.section.set(section);
    this.sectionIndex.set(sectionIndex);
    this.storeService.goToSection(sectionIndex);
    this.forceShowErrors.set(false);
    this.form = this.buildForm(section);
  }

  private buildForm(section: SectionSchema): UntypedFormGroup {
    const group = new UntypedFormGroup({});
    const answers = this.storeService.answers();

    for (const field of section.fields) {
      const validators: ValidatorFn[] = [];
      if (field.required) validators.push(Validators.required);
      if (field.type === 'number') validators.push(numberValidator());

      const existingValue = answers[field.id];
      const initialValue =
        existingValue !== undefined ? existingValue : field.type === 'toggle' ? (field.default ?? false) : '';

      const control = new UntypedFormControl(initialValue, validators);

      control.valueChanges.subscribe((value) => {
        this.storeService.queueAnswer(field.id, value);
      });

      group.addControl(String(field.id), control);
    }

    return group;
  }

  fieldControl(field: FieldSchema): FormControl {
    return this.form.get(String(field.id)) as FormControl;
  }

  saveStatusFor(field: FieldSchema): SaveStatus | undefined {
    return this.storeService.saveStatus()[field.id];
  }

  retryField(field: FieldSchema): void {
    this.storeService.retrySave(field.id);
  }

  /** Side nav only allows jumping back; moving forward must go through Next so validation runs. */
  goToSection(index: number): void {
    const schema = this.schema();
    if (!schema || index >= this.sectionIndex()) return;
    this.router.navigate(['/request', schema.id, 'section', index]);
  }

  goPrevious(): void {
    const schema = this.schema();
    if (!schema) return;
    const prevIndex = this.sectionIndex() - 1;
    if (prevIndex < 0) return;
    this.router.navigate(['/request', schema.id, 'section', prevIndex]);
  }

  goNextOrSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.forceShowErrors.set(true);
      return;
    }

    const schema = this.schema();
    if (!schema) return;

    if (this.isLastSection) {
      this.router.navigate(['/request', schema.id, 'summary']);
      return;
    }

    this.router.navigate(['/request', schema.id, 'section', this.sectionIndex() + 1]);
  }
}
