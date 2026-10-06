import { Routes } from '@angular/router';
import { RequestFormComponent } from './features/request-form/request-form.component';
import { SchemaChooserComponent } from './features/schema-chooser/schema-chooser.component';

export const routes: Routes = [
  { path: '', component: SchemaChooserComponent },
  { path: 'request/:schemaId/section/:sectionIndex', component: RequestFormComponent },
];
