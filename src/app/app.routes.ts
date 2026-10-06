import { Routes } from '@angular/router';
import { RequestFormComponent } from './features/request-form/request-form.component';
import { RequestSummaryComponent } from './features/request-summary/request-summary.component';
import { SchemaChooserComponent } from './features/schema-chooser/schema-chooser.component';

export const routes: Routes = [
  { path: '', component: SchemaChooserComponent },
  { path: 'request/:schemaId/section/:sectionIndex', component: RequestFormComponent },
  { path: 'request/:schemaId/summary', component: RequestSummaryComponent },
  { path: '**', redirectTo: '' },
];
