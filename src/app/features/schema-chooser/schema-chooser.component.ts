import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SchemaApiService } from '../../core/services/schema-api.service';
import { RequestStoreService } from '../../core/services/request-store.service';
import { FormSchema } from '../../core/models/schema.models';

@Component({
  selector: 'app-schema-chooser',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './schema-chooser.component.html',
  styleUrl: './schema-chooser.component.scss',
})
export class SchemaChooserComponent implements OnInit {
  readonly schemas = signal<FormSchema[]>([]);
  readonly loading = signal(true);
  readonly selected = signal<FormSchema | null>(null);

  constructor(
    private readonly schemaApi: SchemaApiService,
    private readonly store: RequestStoreService,
    private readonly router: Router,
  ) {
    // Landing back on the chooser always starts a fresh request.
    this.store.reset();
  }

  ngOnInit(): void {
    this.schemaApi.getSchemas().subscribe((schemas) => {
      this.schemas.set(schemas);
      this.loading.set(false);
    });
  }

  start(): void {
    const schema = this.selected();
    if (!schema) return;
    this.store.selectSchema(schema);
    this.router.navigate(['/request', schema.id, 'section', 0]);
  }

  /** Schemas are dynamic, so the icon is a best-effort match on the id with a generic fallback. */
  iconFor(schema: FormSchema): 'hardware' | 'software' {
    return schema.id.includes('hardware') ? 'hardware' : 'software';
  }

  /** "Software Request" -> "Software", matching the short pill labels in the mockups. */
  optionLabel(schema: FormSchema): string {
    return schema.title.replace(/\s+request$/i, '') || schema.title;
  }
}
