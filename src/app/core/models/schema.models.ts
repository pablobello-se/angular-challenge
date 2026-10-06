export type FieldType = 'text' | 'number' | 'radio' | 'toggle';

export interface FieldSchema {
  id: number;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  default?: unknown;
}

export interface SectionSchema {
  id: string;
  title: string;
  fields: FieldSchema[];
}

export interface FormSchema {
  id: string;
  title: string;
  sections: SectionSchema[];
}

export type SaveStatus = 'idle' | 'saving' | 'retrying' | 'saved' | 'error';
