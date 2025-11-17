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
  label_de?: string;  // Preserved German label for cross-language matching
  label_en?: string;  // Preserved English label for cross-language matching
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
  min?: number;
  max?: number;
  integer?: boolean;
  enum?: string[];
}

export interface NormalizationRules {
  trim?: boolean;
  deduplicate?: boolean;
  map_labels_to_uris?: boolean;
  lowercase?: boolean;
  case?: 'uppercase' | 'lowercase';
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
  prompt?: string; // Optional additional instruction from schema prompt field
  group: string;
  groupLabel: string;
  groupOrder: number;  // Position in schema's groups array
  schemaName: string;  // 'Core', 'Event', etc.
  aiFillable: boolean;  // ai_fillable flag from schema
  repoField: boolean;  // repo_field flag from schema - determines if field should be exported to repository
  status: FieldStatus;
  value: any;
  confidence: number;
  isRequired: boolean;
  datatype: string;
  multiple: boolean;
  vocabulary?: VocabularyInfo;
  validation?: ValidationRules;
  normalization?: NormalizationRules;
  extractionError?: string;
  shape?: any;  // Expected structure for complex objects (from schema items.shape)
  examples?: any[];  // Examples from schema prompt.examples
  promptInstructions?: Record<string, any>;  // Structured instructions from schema
  
  // Nested/Sub-field support for complex objects
  isParent?: boolean;  // True if this field has sub-fields (complex object)
  parentFieldId?: string;  // Reference to parent field (for sub-fields)
  parentFieldLabel?: string;  // Parent field label for display (e.g., "Address (City)")
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
  retryAttempt?: number;
  promptModifier?: string;
}

export interface ExtractionResult {
  fieldId: string;
  value: any;
  confidence: number;
  error?: string;
}
