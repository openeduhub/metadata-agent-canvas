/**
 * Canvas-specific models for field-based metadata extraction
 */

export enum FieldStatus {
  EMPTY = 'empty',
  EXTRACTING = 'extracting',
  FILLED = 'filled',
  ERROR = 'error',
}

export interface VocabularyConcept {
  label: string;
  label_en?: string;
  uri?: string;
  altLabels?: string[];
  schema_file?: string;
  icon?: string;
  description?: string;
}

export interface ValidationRules {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
}

export interface VocabularyInfo {
  type: string;
  concepts: VocabularyConcept[];
}

export interface CanvasFieldState {
  fieldId: string;
  uri: string;  // URI from schema system.uri
  label: string;
  description: string;
  group: string;
  groupLabel: string;
  groupOrder: number;  // Position in schema's groups array
  schemaName: string;  // 'Core', 'Event', etc.
  aiFillable: boolean;  // ai_fillable flag from schema
  status: FieldStatus;
  value: any;
  confidence: number;
  isRequired: boolean;
  datatype: string;
  multiple: boolean;
  vocabulary?: VocabularyInfo;
  validation?: ValidationRules;
  extractionError?: string;
  shape?: any;  // Expected structure for complex objects (from schema items.shape)
  examples?: any[];  // Examples from schema prompt.examples
  
  // Nested/Sub-field support for complex objects
  isParent?: boolean;  // True if this field has sub-fields (complex object)
  parentFieldId?: string;  // Reference to parent field (for sub-fields)
  subFields?: CanvasFieldState[];  // Child fields (for parent fields)
  path?: string;  // JSON path for sub-field (e.g., "address.streetAddress")
  arrayIndex?: number;  // For items in arrays (e.g., location[0], location[1])
}

export interface FieldGroup {
  id: string;
  label: string;
  schemaName: string;
  fields: CanvasFieldState[];
}

export interface CanvasState {
  userText: string;
  detectedContentType: string | null;
  contentTypeConfidence: number;
  contentTypeReason: string;
  selectedContentType: string | null;
  coreFields: CanvasFieldState[];
  specialFields: CanvasFieldState[];
  fieldGroups: FieldGroup[];
  isExtracting: boolean;
  extractionProgress: number;
  totalFields: number;
  filledFields: number;
  metadata: Record<string, any>;
}

export interface FieldExtractionTask {
  field: CanvasFieldState;
  userText: string;
  priority: number; // Required fields have higher priority
}

export interface ExtractionResult {
  fieldId: string;
  value: any;
  confidence: number;
  error?: string;
}
