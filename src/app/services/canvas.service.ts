import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CanvasState, CanvasFieldState, FieldStatus, FieldGroup, FieldExtractionTask, ExtractionResult } from '../models/canvas-models';
import { SchemaLoaderService } from './schema-loader.service';
import { FieldExtractionWorkerPoolService } from './field-extraction-worker-pool.service';
import { FieldNormalizerService } from './field-normalizer.service';
import { OpenAIProxyService } from './openai-proxy.service';
import { ShapeExpanderService } from './shape-expander.service';
import { GeocodingService } from './geocoding.service';
import { I18nService } from './i18n.service';
import { SchemaLocalizerService } from './schema-localizer.service';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CanvasService {
  private stateSubject = new BehaviorSubject<CanvasState>(this.getInitialState());
  public state$: Observable<CanvasState> = this.stateSubject.asObservable();
  
  /** Debounce timer for geocoding (prevents excessive API calls during typing) */
  private geocodingDebounceTimer: any = null;
  private readonly GEOCODING_DEBOUNCE_MS = 1500; // 1.5 seconds after last keystroke

  constructor(
    private schemaLoader: SchemaLoaderService,
    private workerPool: FieldExtractionWorkerPoolService,
    private fieldNormalizer: FieldNormalizerService,
    private openaiProxy: OpenAIProxyService,
    private shapeExpander: ShapeExpanderService,
    private geocodingService: GeocodingService,
    private i18n: I18nService,
    private localizer: SchemaLocalizerService
  ) {
    // Configure worker pool
    this.workerPool.setMaxWorkers(environment.canvas.maxWorkers);
  }

  /**
   * Get initial state
   */
  private getInitialState(): CanvasState {
    return {
      userText: '',
      detectedContentType: null,
      contentTypeConfidence: 0,
      contentTypeReason: '',
      selectedContentType: null,
      coreFields: [],
      specialFields: [],
      fieldGroups: [],
      isExtracting: false,
      extractionProgress: 0,
      totalFields: 0,
      filledFields: 0,
      metadata: {}
    };
  }

  /**
   * Get current state value
   */
  getCurrentState(): CanvasState {
    return this.stateSubject.value;
  }

  /**
   * Update state
   */
  private updateState(partial: Partial<CanvasState>): void {
    const current = this.getCurrentState();
    this.stateSubject.next({ ...current, ...partial });
  }

  /**
   * Start extraction process
   */
  async startExtraction(userText: string): Promise<void> {
    // Get current metadata context for incremental updates
    const metadataContext = this.getCurrentMetadataContext();
    const enrichedUserText = userText + metadataContext;

    // Update state
    this.updateState({
      userText: userText,
      isExtracting: true,
      extractionProgress: 0
    });

    try {
      // Step 1: Load core schema and initialize fields
      await this.initializeCoreFields();

      // Step 2: FIRST detect content type (wichtig!)
      await this.detectContentType(enrichedUserText);

      // Step 3: Load special schema if detected
      const stateAfterDetection = this.getCurrentState();
      if (stateAfterDetection.detectedContentType) {
        await this.loadSpecialSchema(stateAfterDetection.detectedContentType);
        
        // Fill content type field
        this.fillContentTypeField(stateAfterDetection.detectedContentType);
      }

      // Step 4: NOW extract all fields in parallel (with enriched context)
      const state = this.getCurrentState();
      await Promise.all([
        this.extractCoreFields(enrichedUserText),
        state.specialFields.length > 0 ? this.extractSpecialFields(enrichedUserText) : Promise.resolve()
      ]);

      // Step 5: Auto-enrich with geocoding (after extraction complete)
      await this.autoEnrichWithGeocoding();
      
    } catch (error) {
      console.error('❌ Canvas extraction error:', error);
    } finally {
      this.updateState({ isExtracting: false });
    }
  }

  /**
   * Initialize core fields from schema
   */
  private async initializeCoreFields(): Promise<void> {
    const coreSchemaFields = await this.schemaLoader.getFields('core.json').toPromise();
    if (!coreSchemaFields) return;

    const groups = await this.schemaLoader.getGroups('core.json').toPromise();
    const language = this.localizer.getActiveLanguage();
    const groupMap = new Map(
      (groups || []).map((g: any) => [g.id, this.localizer.localizeString(g.label, language)])
    );
    const groupOrderMap = new Map(groups?.map((g: any, index: number) => [g.id, index]) || []);
    
    const coreFields: CanvasFieldState[] = coreSchemaFields
      .filter((field: any) => {
        // Only AI-fillable fields that should be shown to user
        return field.system?.ai_fillable !== false && field.system?.ask_user !== false;
      })
      .map((field: any) => {
        const groupId = field.group || 'other';
        // Priorität: 1. field.group_label, 2. groupMap lookup, 3. 'Sonstige'
        const groupLabel = this.localizer.localizeString(field.group_label, language) 
          || groupMap.get(groupId) 
          || this.localizer.getFallbackGroupLabel(language);
        const groupOrder = groupOrderMap.get(groupId) ?? 999;
        
        const localizedField = this.localizer.localizeField(field, language);

        return {
          fieldId: field.id,
          uri: field.system?.uri || field.id,
          group: groupId,
          groupLabel: String(groupLabel),
          groupOrder: groupOrder,
          schemaName: 'Core',
          aiFillable: field.system?.ai_fillable !== false,
          repoField: field.system?.repo_field !== false,  // Default true if not specified
          label: localizedField.label,
          description: localizedField.description,
          value: field.system?.multiple ? [] : null,
          status: FieldStatus.EMPTY,
          confidence: 0,
          isRequired: field.system?.required || field.required || false,
          datatype: field.system?.datatype || field.type || 'string',
          multiple: field.system?.multiple || false,
          vocabulary: localizedField.vocabulary,
          validation: field.system?.validation,
          // Support both old shape format and new variants format
          shape: field.system?.items?.shape || (field.system?.items?.variants ? field.system.items : null),
          examples: localizedField.examples,
          prompt: localizedField.prompt,
          promptInstructions: field.promptInstructions || undefined
        };
      });

    // Group fields
    const fieldGroups = this.groupFields(coreFields);
    
    // Count only top-level fields (excluding ccm:oeh_flex_lrt for consistency)
    const countableFields = coreFields.filter(f => f.fieldId !== 'ccm:oeh_flex_lrt');
    const totalFieldsCount = countableFields.length;
    
    // Initialize metadata template
    const template = await this.schemaLoader.getOutputTemplate('core.json').toPromise();

    this.updateState({
      coreFields: coreFields,
      fieldGroups: fieldGroups,
      totalFields: totalFieldsCount,  // Include subfields for consistency
      metadata: template || {}
    });
  }

  /**
   * Fill content type field with detected value
   */
  private fillContentTypeField(schemaFile: string): void {
    const state = this.getCurrentState();
    const contentTypeField = state.coreFields.find(f => f.fieldId === 'ccm:oeh_flex_lrt');
    
    if (!contentTypeField || !contentTypeField.vocabulary) {
      return;
    }

    // Find the matching concept
    const concept = contentTypeField.vocabulary.concepts.find(c => c.schema_file === schemaFile);

    if (concept) {
      const localizedLabel = concept.label;
      const metadataValue = {
        schema_file: concept.schema_file || null,
        uri: concept.uri || null,
        label: localizedLabel,
        language: this.i18n.getCurrentLanguage()
      };
      this.updateFieldStatus('ccm:oeh_flex_lrt', FieldStatus.FILLED, localizedLabel, state.contentTypeConfidence);
      this.updateMetadata('ccm:oeh_flex_lrt', metadataValue);
      }
  }

  /**
   * Resolve the content type concept from the current state or a given identifier
   */
  public getContentTypeConcept(identifier?: string): any | null {
    const state = this.getCurrentState();
    
    // Determine target to search for
    const target = identifier
      || (typeof state.metadata['ccm:oeh_flex_lrt'] === 'object' && state.metadata['ccm:oeh_flex_lrt'] !== null
        ? state.metadata['ccm:oeh_flex_lrt'].schema_file || state.metadata['ccm:oeh_flex_lrt'].uri || state.metadata['ccm:oeh_flex_lrt'].label
        : state.metadata['ccm:oeh_flex_lrt'])
      || state.selectedContentType
      || state.detectedContentType;

    if (!target) {
      // Silently return null if no content type is selected yet (normal during initialization)
      return null;
    }

    const normalizedTarget = target.endsWith('.json') ? target : `${target}.json`;

    // Get concepts directly from SchemaLoader (more reliable than from field)
    const concepts = this.schemaLoader.getContentTypeConcepts();
    
    if (!concepts || concepts.length === 0) {
      return null;
    }

    const foundConcept = concepts.find(concept => {
      const labelDe = (concept as any).label_de;
      const labelEn = (concept as any).label_en;
      const conceptLabel = concept.label;
      const conceptUri = (concept as any).uri;
      return concept.schema_file === normalizedTarget
        || concept.schema_file === target
        || conceptUri === target
        || conceptLabel === target
        || labelDe === target
        || labelEn === target
        || conceptLabel === normalizedTarget
        || labelDe === normalizedTarget
        || labelEn === normalizedTarget;
    }) || null;
    
    return foundConcept;
  }

  /**
   * Detect content type in background
   */
  private async detectContentType(userText: string): Promise<void> {
    try {
      const concepts = this.schemaLoader.getContentTypeConcepts()
        .filter(concept => !!concept.schema_file);

      let schemaList: string;

      if (concepts.length > 0) {
        schemaList = concepts.map((concept, index) => {
          const description = concept.description
            ? ` – ${concept.description}`
            : '';
          return `${index + 1}. ${concept.label}${description}\n   Schema-Datei: ${concept.schema_file}`;
        }).join('\n\n');
      } else {
        const availableSchemas = this.schemaLoader.getAvailableSpecialSchemas();
        schemaList = availableSchemas.map((s: string, i: number) =>
          `${i + 1}. ${this.schemaLoader.getContentTypeLabel(s)} (${s})`
        ).join('\n');
      }

      const t = (key: string) => this.i18n.instant(key);
      const rules = t('AI_PROMPTS.CONTENT_TYPE.REASONING_RULES') as any as string[];
      
      const prompt = 
        `${t('AI_PROMPTS.LANGUAGE_INSTRUCTION')}\n\n` +
        `${t('AI_PROMPTS.CONTENT_TYPE.HEADER')}\n\n` +
        `${t('AI_PROMPTS.CONTENT_TYPE.TEXT_LABEL')} "${userText}"\n\n` +
        `${t('AI_PROMPTS.CONTENT_TYPE.AVAILABLE_TYPES')}\n${schemaList}\n\n` +
        `${t('AI_PROMPTS.CONTENT_TYPE.REASONING_IMPORTANT')}\n` +
        rules.map(rule => `- ${rule}`).join('\n') + '\n\n' +
        `${t('AI_PROMPTS.CONTENT_TYPE.RESPONSE_FORMAT')}\n` +
        `{"schema": "<dateiname>.json", "confidence": <0.0-1.0>, "reason": "<definitionsbasierte Begründung>"}\n\n` +
        `${t('AI_PROMPTS.EXTRACTION.EXAMPLES_LABEL')}\n` +
        `- {"schema": "event.json", "confidence": 0.95, "reason": "Zeitlich begrenztes Ereignis mit Termin, Ort und Teilnehmenden (siehe Definition 'Veranstaltung')"}\n` +
        `- {"schema": "education_offer.json", "confidence": 0.88, "reason": "Strukturiertes Lernprogramm mit Lernzielen und Kompetenzaufbau, keine punktuelle Veranstaltung"}\n` +
        `- {"schema": "learning_material.json", "confidence": 0.82, "reason": "Informationsmedium zum direkten Lernen, keine Lernprozess-Struktur"}\n\n` +
        `${t('AI_PROMPTS.CONTENT_TYPE.REASON_LENGTH')}\n` +
        `${t('AI_PROMPTS.CONTENT_TYPE.NO_MATCH')} {"schema": "none", "confidence": 0.0, "reason": "Keine passende Kategorie gefunden"}`;

      const response = await this.openaiProxy.invoke([
        { role: 'user', content: prompt }
      ]);

      const content = response.choices[0].message.content.trim();
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        
        if (result.schema !== 'none' && result.confidence > 0.5) {
          this.updateState({
            detectedContentType: result.schema,
            contentTypeConfidence: result.confidence,
            contentTypeReason: result.reason || 'Automatisch erkannt',
            selectedContentType: result.schema
          });
          
          }
      }
    } catch (error) {
      console.error('Content type detection error:', error);
    }
  }

  /**
   * Extract core fields in parallel
   */
  private async extractCoreFields(userText: string): Promise<void> {
    const state = this.getCurrentState();
    const tasks: FieldExtractionTask[] = state.coreFields
      .filter(f => f.fieldId !== 'ccm:oeh_flex_lrt') // Skip content type field - will be filled by detection
      .map(field => ({
        field: field,
        userText: userText,
        priority: field.isRequired ? 10 : 5,
        retryAttempt: 0
      }));

    const promises = tasks.map(task => this.extractSingleField(task));
    await Promise.all(promises);
  }

  /**
   * Load special schema
   */
  private async loadSpecialSchema(schemaFile: string): Promise<void> {
    const specialSchemaFields = await this.schemaLoader.getFields(schemaFile).toPromise();
    if (!specialSchemaFields) return;

    const groups = await this.schemaLoader.getGroups(schemaFile).toPromise();
    const language = this.localizer.getActiveLanguage();
    const groupMap = new Map(
      (groups || []).map((g: any) => [g.id, this.localizer.localizeString(g.label, language)])
    );
    const groupOrderMap = new Map(groups?.map((g: any, index: number) => [g.id, index]) || []);
    
    const schemaName = schemaFile.replace('.json', '')
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    const specialFields: CanvasFieldState[] = specialSchemaFields
      .filter((field: any) => {
        // Only AI-fillable fields that should be shown to user
        return field.system?.ai_fillable !== false && field.system?.ask_user !== false;
      })
      .map((field: any) => {
        const groupId = field.group || 'other';
        // Priorität: 1. field.group_label, 2. groupMap lookup, 3. 'Sonstige'
        const groupLabel = this.localizer.localizeString(field.group_label, language) 
          || groupMap.get(groupId) 
          || this.localizer.getFallbackGroupLabel(language);
        const groupOrder = groupOrderMap.get(groupId) ?? 999;
        
        const localizedField = this.localizer.localizeField(field, language);
        
        // IMPORTANT: Fallback to field.id if label is missing
        const fieldLabel = localizedField.label || field.id;
        if (!localizedField.label) {
          }

        return {
          fieldId: field.id,
          uri: field.system?.uri || field.id,
          group: groupId,
          groupLabel: String(groupLabel),
          groupOrder: groupOrder,
          schemaName: schemaName,
          aiFillable: field.system?.ai_fillable !== false,
          repoField: field.system?.repo_field !== false,  // Default true if not specified
          label: fieldLabel,
          description: localizedField.description,
          value: field.system?.multiple ? [] : null,
          status: FieldStatus.EMPTY,
          confidence: 0,
          isRequired: field.system?.required || field.required || false,
          datatype: field.system?.datatype || field.type || 'string',
          multiple: field.system?.multiple || false,
          vocabulary: localizedField.vocabulary,
          validation: field.system?.validation,
          // Support both old shape format and new variants format
          shape: field.system?.items?.shape || (field.system?.items?.variants ? field.system.items : null),
          examples: localizedField.examples,
          prompt: localizedField.prompt,
          promptInstructions: field.promptInstructions || undefined
        };
      });

    const state = this.getCurrentState();
    const allFields = [...state.coreFields, ...specialFields];
    const fieldGroups = this.groupFields(allFields);

    // Count only top-level fields (excluding ccm:oeh_flex_lrt for consistency)
    const countableFields = allFields.filter(f => f.fieldId !== 'ccm:oeh_flex_lrt');
    const totalFieldsCount = countableFields.length;

    // Merge template
    const template = await this.schemaLoader.getOutputTemplate(schemaFile).toPromise();
    const mergedMetadata = { ...state.metadata, ...(template || {}) };

    this.updateState({
      specialFields: specialFields,
      fieldGroups: fieldGroups,
      totalFields: totalFieldsCount,  // Include subfields for consistency
      metadata: mergedMetadata
    });
  }

  /**
   * Extract special fields in parallel
   */
  private async extractSpecialFields(userText: string): Promise<void> {
    const state = this.getCurrentState();
    const tasks: FieldExtractionTask[] = state.specialFields.map(field => ({
      field: field,
      userText: userText,
      priority: field.isRequired ? 10 : 5,
      retryAttempt: 0
    }));

    const promises = tasks.map(task => this.extractSingleField(task));
    await Promise.all(promises);
  }

  /**
   * Extract single field
   */
  private async extractSingleField(task: FieldExtractionTask, isRetry: boolean = false): Promise<void> {
    const effectiveTask = isRetry
      ? {
          ...task,
          retryAttempt: (task.retryAttempt ?? 0) + 1,
          promptModifier: this.buildRetryPromptModifier(task.field, (task.retryAttempt ?? 0) + 1)
        }
      : task;

    const fieldId = effectiveTask.field.fieldId;

    this.updateFieldStatus(fieldId, FieldStatus.EXTRACTING);

    try {
      const result = await this.workerPool.extractField(effectiveTask);

      if (result.error) {
        this.updateFieldStatus(
          result.fieldId,
          FieldStatus.ERROR,
          null,
          0,
          result.error
        );
      } else {
        // Check if value is actually filled
        const isFilled = this.isValueFilled(result.value);
        const status = isFilled ? FieldStatus.FILLED : FieldStatus.EMPTY;
        
        // Temporarily set the field status
        this.updateFieldStatus(
          result.fieldId,
          status,
          result.value,
          result.confidence
        );
        
        if (isFilled) {
          // IMPORTANT: Normalize AI-extracted values (same as user inputs)
          // This includes vocabulary matching, fuzzy matching, date/URL normalization
          const attemptedRetry = (effectiveTask.retryAttempt ?? 0) > 0;
          await this.normalizeAiExtractedValue(result.fieldId, result.value, result.confidence, effectiveTask, attemptedRetry);
          
          // Create sub-fields for fields with shape or variants (complex objects)
          if (effectiveTask.field.shape || effectiveTask.field.datatype === 'array') {
            // Get full schema definition for this field
            const schemaName = effectiveTask.field.schemaName === 'Core' ? 'core.json' : this.getCurrentState().selectedContentType;
            const schema = schemaName ? this.schemaLoader.getCachedSchema(schemaName) : null;
            const schemaFieldDef = schema?.fields?.find((f: any) => f.id === result.fieldId);
            
            if (schemaFieldDef) {
              }
            
            const subFields = this.shapeExpander.expandFieldWithShape(
              effectiveTask.field, 
              result.value,
              schemaFieldDef  // Pass full schema definition
            );
            
            if (subFields.length > 0) {
              // Mark parent as having sub-fields
              const state = this.getCurrentState();
              const parentField = [...state.coreFields, ...state.specialFields]
                .find(f => f.fieldId === result.fieldId);
              
              if (parentField) {
                parentField.isParent = true;
                parentField.subFields = subFields;
              }
              
              // Add sub-fields to the appropriate list
              const isCore = state.coreFields.some(f => f.fieldId === result.fieldId);
              if (isCore) {
                this.updateState({
                  coreFields: [...state.coreFields]
                });
              } else {
                this.updateState({
                  specialFields: [...state.specialFields]
                });
              }
              
              }
          }
        }
      }
    } catch (error) {
      console.error(`Field extraction error for ${fieldId}:`, error);
      this.updateFieldStatus(fieldId, FieldStatus.ERROR, null, 0, 'Extraction failed');
    }
  }

  /**
   * Check if a value is actually filled (not null, empty string, or empty array)
   */
  private isValueFilled(value: any): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    
    if (typeof value === 'string' && value.trim() === '') {
      return false;
    }
    
    if (Array.isArray(value) && value.length === 0) {
      return false;
    }
    
    if (Array.isArray(value)) {
      // Check if all array elements are empty
      return value.some(v => v !== null && v !== undefined && v.toString().trim() !== '');
    }
    
    return true;
  }

  /**
   * Update field status
   */
  private updateFieldStatus(
    fieldId: string, 
    status: FieldStatus, 
    value?: any, 
    confidence?: number,
    error?: string
  ): void {
    // Remove duplicates from array values
    if (Array.isArray(value)) {
      value = [...new Set(value)];
    }
    
    const state = this.getCurrentState();
    
    // Helper to update a field (including subFields)
    const updateField = (f: CanvasFieldState): CanvasFieldState => {
      // Check if this is the target field
      if (f.fieldId === fieldId) {
        const updated = { ...f };  // Clone field
        updated.status = status;
        if (value !== undefined) updated.value = value;
        if (confidence !== undefined) updated.confidence = confidence;
        if (error) updated.extractionError = error;
        return updated;
      }
      
      // Check subFields if this is a parent field
      if (f.isParent && f.subFields && f.subFields.length > 0) {
        const updatedSubFields = f.subFields.map(sf => {
          if (sf.fieldId === fieldId) {
            const updated = { ...sf };
            updated.status = status;
            if (value !== undefined) updated.value = value;
            if (confidence !== undefined) updated.confidence = confidence;
            if (error) updated.extractionError = error;
            return updated;
          }
          return sf;
        });
        
        // Only return a new parent if subfields were updated
        if (updatedSubFields !== f.subFields) {
          return { ...f, subFields: updatedSubFields };
        }
      }
      
      return f;
    };
    
    // Create NEW arrays with updated field (wichtig für Change Detection!)
    const updatedCoreFields = state.coreFields.map(updateField);
    const updatedSpecialFields = state.specialFields.map(updateField);

    // Collect all fields including subfields
    const allSubFields: CanvasFieldState[] = [];
    [...updatedCoreFields, ...updatedSpecialFields].forEach(field => {
      if (field.isParent && field.subFields) {
        allSubFields.push(...field.subFields);
      }
    });
    
    const allFields = [...updatedCoreFields, ...updatedSpecialFields];
    
    // Count only top-level fields (excluding ccm:oeh_flex_lrt for consistency)
    const countableFields = allFields.filter(f => f.fieldId !== 'ccm:oeh_flex_lrt');
    const filledFields = countableFields.filter(f => {
      if (f.status !== FieldStatus.FILLED) return false;
      const v = f.value;
      // Skip arrays with only empty objects
      if (Array.isArray(v) && v.every((item: any) => 
        typeof item === 'object' && item !== null && Object.keys(item).length === 0)) return false;
      return true;
    }).length;
    const totalFieldsCount = countableFields.length;
    const extractionProgress = totalFieldsCount > 0 ? (filledFields / totalFieldsCount) * 100 : 0;

    // Regroup fields (only top-level fields, subfields are accessed via field.subFields)
    const fieldGroups = this.groupFields(allFields);

    this.updateState({
      coreFields: updatedCoreFields,  // NEUE Arrays!
      specialFields: updatedSpecialFields,
      fieldGroups: fieldGroups,
      filledFields: filledFields,
      totalFields: totalFieldsCount,  // Update total to include subfields
      extractionProgress: extractionProgress
    });
  }

  /**
   * Update metadata object
   */
  private updateMetadata(fieldId: string, value: any): void {
    // Remove duplicates from array values
    if (Array.isArray(value)) {
      value = [...new Set(value)];
    }
    
    const state = this.getCurrentState();
    const metadata = { ...state.metadata };
    metadata[fieldId] = value;
    this.updateState({ metadata: metadata });
  }

  /**
   * Group fields by schema AND group (separate Core-Basic from Event-Basic)
   */
  private groupFields(fields: CanvasFieldState[]): FieldGroup[] {
    const groups = new Map<string, FieldGroup & { order: number }>();

    fields.forEach(field => {
      const schemaName = field.schemaName || 'Core';
      const groupId = field.group || 'other';
      const groupLabel = field.groupLabel || 'Sonstige';
      const groupOrder = field.groupOrder ?? 999;
      
      // WICHTIG: Key ist Schema + Group, damit Core-Basic ≠ Event-Basic
      const groupKey = `${schemaName}::${groupId}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupId,
          label: groupLabel,
          schemaName: schemaName,
          fields: [],
          order: groupOrder  // Use order from field
        });
      }
      
      groups.get(groupKey)!.fields.push(field);
    });

    // Sortierung
    const result = Array.from(groups.values())
      .filter(g => g.fields.length > 0)  // Nur Gruppen mit Feldern anzeigen
      .sort((a, b) => {
        // Core immer zuerst
        if (a.schemaName === 'Core' && b.schemaName !== 'Core') return -1;
        if (a.schemaName !== 'Core' && b.schemaName === 'Core') return 1;
        
        // Dann alphabetisch nach Schema
        if (a.schemaName !== b.schemaName) {
          return a.schemaName.localeCompare(b.schemaName);
        }
        
        // Innerhalb eines Schemas: Nach order-Index (aus groups-Array)
        return a.order - b.order;
      });
    
    result.forEach((g, index) => {
      g.fields.forEach(f => {
        });
    });
    
    return result;
  }

  /**
   * User manually changes a field value
   */
  updateFieldValue(fieldId: string, value: any): void {
    // Special handling for content type change (needs immediate update)
    if (fieldId === 'ccm:oeh_flex_lrt') {
      this.updateFieldStatus(fieldId, FieldStatus.FILLED, value, 1.0);
      this.updateMetadata(fieldId, value);
      this.onContentTypeChange(value);
      return;
    }
    
    // For other fields: Normalize FIRST, then update
    // This ensures the user sees the corrected value immediately
    this.normalizeFieldValue(fieldId, value);
  }

  /**
   * Normalize and re-classify a field value
   */
  private normalizeFieldValue(fieldId: string, value: any): void {
    const state = this.getCurrentState();
    let field = [...state.coreFields, ...state.specialFields].find(f => f.fieldId === fieldId);
    
    // If not found in top-level, search in sub-fields
    if (!field) {
      for (const parentField of [...state.coreFields, ...state.specialFields]) {
        if (parentField.subFields && parentField.subFields.length > 0) {
          const subField = parentField.subFields.find(sf => sf.fieldId === fieldId);
          if (subField) {
            field = subField;
            break;
          }
        }
      }
    }
    
    if (!field) {
      return;
    }

    // Check if this is an address field change - trigger re-geocoding with debounce
    if (this.isAddressField(fieldId)) {
      // Clear previous timer to implement debounce
      if (this.geocodingDebounceTimer) {
        clearTimeout(this.geocodingDebounceTimer);
      }
      // Only trigger geocoding after user stops typing for 1.5 seconds
      this.geocodingDebounceTimer = setTimeout(() => {
        this.triggerReGeocoding(fieldId);
        this.geocodingDebounceTimer = null;
      }, this.GEOCODING_DEBOUNCE_MS);
    }

    // Skip normalization for structured fields (fields with shape definition)
    // These should keep their object structure intact
    if (field.shape || field.datatype === 'object') {
      const newStatus = (value === null || (Array.isArray(value) && value.length === 0))
        ? FieldStatus.EMPTY 
        : FieldStatus.FILLED;
      this.updateFieldStatus(fieldId, newStatus, value, 1.0);
      this.updateMetadata(fieldId, value);
      return;
    }

    // Use FieldNormalizerService to normalize/classify the value
    this.fieldNormalizer.normalizeValue(field, value).subscribe({
      next: (normalizedValue: any) => {
        // Handle null/invalid values for controlled vocabularies (closed or skos)
        const isControlled = field.vocabulary?.type === 'closed' || field.vocabulary?.type === 'skos';
        if (normalizedValue === null && isControlled) {
          // Clear the field
          this.updateFieldStatus(fieldId, FieldStatus.EMPTY, null, 0);
          this.updateMetadata(fieldId, null);
          return;
        }
        
        // Determine final status
        const newStatus = (normalizedValue === null || 
                          (Array.isArray(normalizedValue) && normalizedValue.length === 0))
          ? FieldStatus.EMPTY 
          : FieldStatus.FILLED;
        
        // Check if normalization changed the value
        const valueChanged = JSON.stringify(normalizedValue) !== JSON.stringify(value);
        
        if (valueChanged) {
          // Special handling for arrays: Check if items were removed
          if (Array.isArray(value) && Array.isArray(normalizedValue)) {
            if (normalizedValue.length < value.length) {
              const removedItems = value.filter(v => !normalizedValue.includes(v));
              }
          }
        } else {
          }
        
        // ALWAYS update the field (even if unchanged) to ensure UI consistency
        this.updateFieldStatus(fieldId, newStatus, normalizedValue, 1.0);
        this.updateMetadata(fieldId, normalizedValue);
      },
      error: (error: any) => {
        console.error(`❌ Normalization failed for ${fieldId}:`, error);
        // On error: Still update with original value
        this.updateFieldStatus(fieldId, FieldStatus.FILLED, value, 1.0);
        this.updateMetadata(fieldId, value);
      }
    });
  }

  /**
   * Normalize AI-extracted value with retry on failure
   */
  private async normalizeAiExtractedValue(
    fieldId: string, 
    value: any, 
    confidence: number, 
    task: FieldExtractionTask, 
    isRetry: boolean
  ): Promise<void> {
    const field = task.field;

    // Skip normalization for structured fields (fields with shape definition)
    if (field.shape || field.datatype === 'object') {
      this.updateMetadata(fieldId, value);
      return;
    }

    // Use FieldNormalizerService to normalize/classify the value
    return new Promise((resolve) => {
      this.fieldNormalizer.normalizeValue(field, value).subscribe({
        next: (normalizedValue: any) => {
          // Check if normalization failed for controlled vocabularies
          const isControlled = field.vocabulary?.type === 'closed' || field.vocabulary?.type === 'skos';
          const normalizationFailed = normalizedValue === null && isControlled;
          
          if (normalizationFailed) {
            // Retry ONCE if this is the first attempt
            if (!isRetry) {
              this.retryFieldExtractionWithStricterPrompt(task).then(resolve);
              return;
            } else {
              console.error(`❌ Second attempt also failed for ${fieldId}. Clearing field.`);
              this.updateFieldStatus(fieldId, FieldStatus.EMPTY, null, 0);
              this.updateMetadata(fieldId, null);
              resolve();
              return;
            }
          }
          
          // Determine final status
          const newStatus = (normalizedValue === null || 
                            (Array.isArray(normalizedValue) && normalizedValue.length === 0))
            ? FieldStatus.EMPTY 
            : FieldStatus.FILLED;
          
          // Check if normalization changed the value
          const valueChanged = JSON.stringify(normalizedValue) !== JSON.stringify(value);
          
          if (valueChanged) {
            }
          
          // Update with normalized value
          this.updateFieldStatus(fieldId, newStatus, normalizedValue, confidence);
          this.updateMetadata(fieldId, normalizedValue);
          resolve();
        },
        error: (error: any) => {
          console.error(`❌ Normalization failed for AI-extracted ${fieldId}:`, error);
          // On error: Still update with original value
          this.updateFieldStatus(fieldId, FieldStatus.FILLED, value, confidence);
          this.updateMetadata(fieldId, value);
          resolve();
        }
      });
    });
  }

  /**
   * Retry field extraction with stricter vocabulary prompt
   */
  private async retryFieldExtractionWithStricterPrompt(task: FieldExtractionTask): Promise<void> {
    const nextAttempt = (task.retryAttempt ?? 0) + 1;
    if (task.field.vocabulary) {
      const vocabSample = task.field.vocabulary.concepts
        .slice(0, 10)
        .map(c => c.label)
        .join(', ');
      }
    
    const retryTask: FieldExtractionTask = {
      ...task,
      retryAttempt: nextAttempt,
      promptModifier: this.buildRetryPromptModifier(task.field, nextAttempt)
    };

    await this.extractSingleField(retryTask, true);
  }

  private buildRetryPromptModifier(field: CanvasFieldState, attempt: number): string {
    const t = (key: string, params?: any) => this.i18n.instant(key, params);
    
    const base = t('AI_PROMPTS.EXTRACTION.RETRY.ATTEMPT', {attempt});
    const vocabularyHint = field.vocabulary
      ? t('AI_PROMPTS.EXTRACTION.RETRY.VOCABULARY_HINT')
      : t('AI_PROMPTS.EXTRACTION.RETRY.DEFAULT_HINT');
    const formatting = t('AI_PROMPTS.EXTRACTION.RETRY.FORMATTING');
    return `${base} ${vocabularyHint} ${formatting}`;
  }

  /**
   * Public method to change content type (called from UI)
   */
  async changeContentTypeManually(schemaFile: string): Promise<void> {
    const state = this.getCurrentState();
    
    // Update selected content type and set confidence to 1.0 (user manually selected = 100% confident)
    this.updateState({ 
      selectedContentType: schemaFile,
      contentTypeConfidence: 1.0, // Manual selection = 100% confident
      contentTypeReason: 'Vom Nutzer manuell ausgewählt',
      specialFields: [] 
    });
    
    // Reload special schema
    await this.loadSpecialSchema(schemaFile);
    
    // Re-extract special fields if we have user text
    if (state.userText) {
      await this.extractSpecialFields(state.userText);
    }
    
    }

  /**
   * Handle content type change (automatic during extraction)
   */
  private async onContentTypeChange(contentType: string | string[]): Promise<void> {
    // Get schema file from vocabulary
    const state = this.getCurrentState();
    const contentTypeField = state.coreFields.find(f => f.fieldId === 'ccm:oeh_flex_lrt');
    
    if (!contentTypeField?.vocabulary) return;

    const selectedType = Array.isArray(contentType) ? contentType[0] : contentType;
    const concept = contentTypeField.vocabulary.concepts.find(c => 
      c.label === selectedType || c.uri === selectedType
    );

    if (concept?.schema_file) {
      // Clear special fields
      this.updateState({ specialFields: [], selectedContentType: concept.schema_file });
      
      // Reload special schema and extract
      await this.loadSpecialSchema(concept.schema_file);
      await this.extractSpecialFields(state.userText);
    }
  }

  /**
   * Get metadata for Browser-Plugin in NEW format with repoField flag
   * v2.1.0: Switched from old format to new object format for better Plugin compatibility
   * Converts {label, uri} objects to URI strings and wraps in {value, repoField, ...} structure
   */
  getMetadataForPlugin(): Record<string, any> {
    const state = this.getCurrentState();
    const allFields = [...state.coreFields, ...state.specialFields];
    
    // Create a map of fieldId to field object
    const fieldMap = new Map<string, CanvasFieldState>();
    allFields.forEach(field => {
      fieldMap.set(field.fieldId, field);
    });
    
    // Build a set of sub-field IDs to exclude from output
    const subFieldIds = new Set<string>();
    allFields.forEach(field => {
      if (field.isParent && field.subFields) {
        field.subFields.forEach((sf: CanvasFieldState) => subFieldIds.add(sf.fieldId));
      }
    });
    
    // Build output in NEW format with repoField flag
    const output: Record<string, any> = {};
    
    Object.keys(state.metadata).forEach(fieldId => {
      const value = state.metadata[fieldId];
      const field = fieldMap.get(fieldId);
      
      // Skip sub-fields
      if (subFieldIds.has(fieldId)) {
        return;
      }
      
      if (!field) {
        // Unknown field: send as-is with repoField=true
        output[fieldId] = {
          value: value,
          repoField: true
        };
        return;
      }
      
      // Determine if field should be written to repository
      const repoField = field.repoField !== false; // Default: true unless explicitly false
      
      // Check if field has sub-fields (complex object)
      if (field.isParent && field.subFields && field.subFields.length > 0) {
        const reconstructedValue = this.shapeExpander.reconstructObjectFromSubFields(field, allFields);
        output[fieldId] = {
          value: reconstructedValue,
          repoField: repoField,
          hasSubFields: true
        };
        return;
      }
      
      // Convert vocabulary values: {label, uri} → uri string
      let processedValue = value;
      if (field.vocabulary && field.vocabulary.concepts && field.vocabulary.concepts.length > 0) {
        if (Array.isArray(value)) {
          // Array: Extract URIs from each {label, uri} object
          processedValue = value
            .filter(v => v !== null && v !== undefined && v !== '')
            .map(v => {
              if (typeof v === 'object' && (v as any).uri) {
                return (v as any).uri; // Already {label, uri} format
              }
              // Find URI from vocabulary
              const concept = field.vocabulary!.concepts.find((c: any) => 
                c.uri === v || c.label === v || (c.altLabels && c.altLabels.includes(v))
              );
              return concept ? concept.uri : v;
            });
        } else if (value !== null && value !== undefined && value !== '') {
          // Single value: Extract URI
          if (typeof value === 'object' && (value as any).uri) {
            processedValue = [(value as any).uri]; // Repository expects array
          } else {
            // Find URI from vocabulary
            const concept = field.vocabulary!.concepts.find((c: any) => 
              c.uri === value || c.label === value || (c.altLabels && c.altLabels.includes(value))
            );
            processedValue = concept ? [concept.uri] : [value];
          }
        } else {
          processedValue = [];
        }
        
        // NEW FORMAT: Wrap in object with vocabulary metadata
        output[fieldId] = {
          value: processedValue,
          repoField: repoField,
          hasVocabulary: true,
          vocabularyType: (field.vocabulary as any).vocabularyType || field.vocabulary.type || 'closed'
        };
      } else {
        // Non-vocabulary field: ensure arrays
        if (field.multiple && !Array.isArray(value)) {
          processedValue = value ? [value] : [];
        } else if (!field.multiple && Array.isArray(value)) {
          processedValue = value.length > 0 ? value[0] : null;
        }
        
        // NEW FORMAT: Wrap in object
        output[fieldId] = {
          value: processedValue,
          repoField: repoField
        };
      }
    });
    
    return output;
  }

  /**
   * Get metadata formatted for repository submission (legacy format)
   * Mirrors the behavior of the previously working web component and browser plugin
   * - Vocabulary values become URI strings
   * - Multi-value fields are arrays
   * - Complex objects are reconstructed from sub-fields
   */
  getMetadataForRepository(): Record<string, any> {
    const state = this.getCurrentState();
    const allFields = [...state.coreFields, ...state.specialFields];

    const fieldMap = new Map<string, CanvasFieldState>();
    allFields.forEach(field => fieldMap.set(field.fieldId, field));

    const subFieldIds = new Set<string>();
    allFields.forEach(field => {
      if (field.isParent && field.subFields) {
        field.subFields.forEach(subField => subFieldIds.add(subField.fieldId));
      }
    });

    const normalizeVocabularyValue = (value: any, field: CanvasFieldState): string | null => {
      if (value === null || value === undefined || value === '') {
        return null;
      }

      if (typeof value === 'object' && value !== null && 'uri' in value) {
        return (value as any).uri || null;
      }

      const concept = field.vocabulary?.concepts.find(con => {
        if (!con) {
          return false;
        }
        if (con.uri && con.uri === value) {
          return true;
        }
        if (con.label && con.label === value) {
          return true;
        }
        return Array.isArray(con.altLabels) && con.altLabels.includes(value);
      });

      return concept?.uri || (typeof value === 'string' ? value : null);
    };

    const result: Record<string, any> = {};

    Object.entries(state.metadata).forEach(([fieldId, rawValue]) => {
      const field = fieldMap.get(fieldId);

      if (field && subFieldIds.has(fieldId)) {
        // Sub-fields are handled when reconstructing their parent field
        return;
      }

      if (field && field.isParent && field.subFields && field.subFields.length > 0) {
        result[fieldId] = this.shapeExpander.reconstructObjectFromSubFields(field, allFields);
        return;
      }

      if (field && field.vocabulary && field.vocabulary.concepts && field.vocabulary.concepts.length > 0) {
        const valuesArray = Array.isArray(rawValue)
          ? rawValue
          : (rawValue === null || rawValue === undefined || rawValue === '' ? [] : [rawValue]);

        const normalized = valuesArray
          .map(entry => normalizeVocabularyValue(entry, field))
          .filter((entry): entry is string => entry !== null && entry !== undefined && entry !== '');

        result[fieldId] = normalized;
        return;
      }

      if (field) {
        if (field.multiple) {
          if (Array.isArray(rawValue)) {
            result[fieldId] = rawValue.filter(item => item !== null && item !== undefined && item !== '');
          } else if (rawValue === null || rawValue === undefined || rawValue === '') {
            result[fieldId] = [];
          } else {
            result[fieldId] = [rawValue];
          }
        } else {
          if (Array.isArray(rawValue)) {
            const first = rawValue.find(item => item !== null && item !== undefined && item !== '');
            result[fieldId] = first !== undefined ? first : null;
          } else if (rawValue === undefined) {
            result[fieldId] = null;
          } else {
            result[fieldId] = rawValue;
          }
        }
        return;
      }

      // Fallback for fields not in schema (e.g., virtual fields)
      if (Array.isArray(rawValue)) {
        result[fieldId] = rawValue.filter(item => item !== null && item !== undefined && item !== '');
      } else {
        result[fieldId] = rawValue;
      }
    });

    return result;
  }

  /**
   * Get metadata JSON with URI and label information
   * Uses the new structured format from exportAsJson()
   */
  getMetadataJson(): string {
    return JSON.stringify(this.exportAsJson(), null, 2);
  }
  
  /**
   * Map a value (label or URI) to {label, uri} pair from vocabulary concepts
   */
  private mapValueToLabelUri(value: string, concepts: any[]): { label: string; uri: string } {
    // Try to find concept by URI first (normalization sets URIs as values)
    let concept = concepts.find(c => c.uri === value);
    
    // If not found by URI, try by label
    if (!concept) {
      concept = concepts.find(c => c.label === value);
    }
    
    // If not found by label, try by altLabels
    if (!concept) {
      concept = concepts.find(c => 
        c.altLabels && Array.isArray(c.altLabels) && c.altLabels.includes(value)
      );
    }
    
    if (concept) {
      return {
        label: concept.label,
        uri: concept.uri || ''
      };
    }
    
    // Fallback: value not found in vocabulary
    return {
      label: value,
      uri: ''
    };
  }

  /**
   * Enrich metadata with geocoding data before export
   * Called right before download to add geo-coordinates to location fields
   */
  async enrichWithGeocodingBeforeExport(): Promise<void> {
    const state = this.getCurrentState();
    const metadata = { ...state.metadata };
    const allFields = [...state.coreFields, ...state.specialFields];

    // List of fields that may contain location data
    const locationFields = [
      'schema:location',      // Events, Education Offers
      'schema:address',       // Organizations
      'schema:legalAddress'   // Organizations
    ];

    let geocodedCount = 0;

    for (const fieldId of locationFields) {
      let value = metadata[fieldId];

      // Check if field has sub-fields that need to be reconstructed first
      const field = allFields.find(f => f.fieldId === fieldId);
      if (field && field.isParent && field.subFields && field.subFields.length > 0) {
        value = this.shapeExpander.reconstructObjectFromSubFields(field, allFields);
        metadata[fieldId] = value; // Update metadata with reconstructed value
      }

      if (!value) {
        continue; // Field not present or empty
      }

      try {
        // Handle array of locations (e.g., multiple event venues)
        if (Array.isArray(value)) {
          const geocodedLocations = await this.geocodingService.geocodeLocations(value);
          metadata[fieldId] = geocodedLocations;
          
          const newGeoCount = geocodedLocations.filter(l => l.geo).length;
          const oldGeoCount = value.filter((l: any) => l.geo).length;
          geocodedCount += (newGeoCount - oldGeoCount);
          
        } else if (typeof value === 'object' && value !== null) {
          // Handle single location/address object
          if (value['@type'] === 'Place' && value.address) {
            // It's a Place with address
            const geocodedPlace = await this.geocodingService.geocodePlace(value);
            metadata[fieldId] = geocodedPlace;
            if (geocodedPlace.geo && !value.geo) {
              geocodedCount++;
            }
          } else if (value.streetAddress || value.postalCode) {
            // It's a PostalAddress - geocode it
            const geoResult = await this.geocodingService.geocodeAddress(value);
            if (geoResult) {
              // Add geo data as separate field or enrich address
              metadata[`${fieldId}_geo`] = {
                '@type': 'GeoCoordinates',
                latitude: geoResult.latitude,
                longitude: geoResult.longitude
              };
              geocodedCount++;
            }
          }
        }
      } catch (error) {
        console.error(`❌ Geocoding failed for ${fieldId}:`, error);
        // Continue with other fields
      }
    }

    if (geocodedCount > 0) {
      // Update metadata in state
      this.updateState({ metadata });
    } else {
      }
  }

  /**
   * Check if a field is an address-related field
   */
  private isAddressField(fieldId: string): boolean {
    return fieldId.includes('streetAddress') || 
           fieldId.includes('postalCode') || 
           fieldId.includes('addressLocality') || 
           fieldId.includes('addressCountry') ||
           fieldId.includes('addressRegion');
  }
  
  /**
   * Trigger re-geocoding when user changes an address field
   * Handles multiple locations by extracting array index from changed field
   */
  private async triggerReGeocoding(fieldId: string): Promise<void> {
    const state = this.getCurrentState();
    const allFields = [...state.coreFields, ...state.specialFields];
    
    // Extract array index from the changed field (e.g., "schema:location[1].address.streetAddress" -> 1)
    const getArrayIndex = (fId: string): number => {
      const match = fId.match(/\[(\d+)\]/);
      return match ? parseInt(match[1], 10) : 0;
    };
    const changedArrayIndex = getArrayIndex(fieldId);
    
    
    // Find the parent location field for this address field
    let parentField: any = null;
    for (const field of allFields) {
      if (field.isParent && field.subFields) {
        // Search recursively in subFields
        const findInSubFields = (fields: any[]): boolean => {
          for (const sf of fields) {
            if (sf.fieldId === fieldId) return true;
            if (sf.subFields && findInSubFields(sf.subFields)) return true;
          }
          return false;
        };
        if (findInSubFields(field.subFields)) {
          parentField = field;
          break;
        }
      }
    }
    
    if (!parentField) {
      return;
    }
    
    const subFields = parentField.subFields!;
    
    // Recursive helper to find field matching predicate AND array index
    const findFieldRecursive = (fields: any[], predicate: (f: any) => boolean): any => {
      for (const f of fields) {
        if (predicate(f) && getArrayIndex(f.fieldId) === changedArrayIndex) return f;
        if (f.subFields && f.subFields.length > 0) {
          const found = findFieldRecursive(f.subFields, predicate);
          if (found) return found;
        }
      }
      return null;
    };
    
    // Build address from current sub-field values (search recursively, matching array index)
    const streetField = findFieldRecursive(subFields, (sf: any) => sf.fieldId.includes('streetAddress'));
    const postalField = findFieldRecursive(subFields, (sf: any) => sf.fieldId.includes('postalCode'));
    const localityField = findFieldRecursive(subFields, (sf: any) => sf.fieldId.includes('addressLocality'));
    const regionField = findFieldRecursive(subFields, (sf: any) => sf.fieldId.includes('addressRegion'));
    const countryField = findFieldRecursive(subFields, (sf: any) => sf.fieldId.includes('addressCountry'));
    
    // Find geo coordinate fields (nested under geo parent, matching array index)
    const latField = findFieldRecursive(subFields, (sf: any) => sf.fieldId.includes('latitude'));
    const lonField = findFieldRecursive(subFields, (sf: any) => sf.fieldId.includes('longitude'));
    
    // Check if we have enough address data
    const hasAddress = (streetField?.value || postalField?.value || localityField?.value);
    
    if (!hasAddress) {
      return;
    }
    
    if (!latField || !lonField) {
      return;
    }
    
    const address: any = {
      streetAddress: streetField?.value || '',
      postalCode: postalField?.value || '',
      addressLocality: localityField?.value || '',
      addressRegion: regionField?.value || '',
      addressCountry: countryField?.value || ''
    };
    
    try {
      const geoResult = await this.geocodingService.geocodeAddress(address);
      
      if (geoResult) {
        // Update latitude field using proper method (ensures Change Detection)
        this.updateFieldStatus(latField.fieldId, FieldStatus.FILLED, geoResult.latitude, 1.0);
        this.updateMetadata(latField.fieldId, geoResult.latitude);
        
        // Update longitude field using proper method (ensures Change Detection)
        this.updateFieldStatus(lonField.fieldId, FieldStatus.FILLED, geoResult.longitude, 1.0);
        this.updateMetadata(lonField.fieldId, geoResult.longitude);
        
        // Update region and country if returned
        if (geoResult.enrichedAddress?.addressRegion && regionField && !regionField.value) {
          this.updateFieldStatus(regionField.fieldId, FieldStatus.FILLED, geoResult.enrichedAddress.addressRegion, 1.0);
          this.updateMetadata(regionField.fieldId, geoResult.enrichedAddress.addressRegion);
        }
        if (geoResult.enrichedAddress?.addressCountry && countryField && !countryField.value) {
          this.updateFieldStatus(countryField.fieldId, FieldStatus.FILLED, geoResult.enrichedAddress.addressCountry, 1.0);
          this.updateMetadata(countryField.fieldId, geoResult.enrichedAddress.addressCountry);
        }
      }
    } catch (error) {
      console.error(`❌ Re-geocoding failed:`, error);
    }
  }

  /**
   * Auto-enrich with geocoding after extraction
   * Fills empty geo fields (latitude/longitude) automatically
   * Handles multiple locations in arrays (e.g., schema:location[0], schema:location[1])
   */
  private async autoEnrichWithGeocoding(): Promise<void> {
    const state = this.getCurrentState();
    const allFields = [...state.coreFields, ...state.specialFields];
    
    // Find location parent fields (schema:location, schema:address, schema:legalAddress)
    const locationParentFields = allFields.filter(f => 
      (f.fieldId === 'schema:location' || f.fieldId === 'schema:address' || f.fieldId === 'schema:legalAddress') 
      && f.isParent 
      && f.subFields 
      && f.subFields.length > 0
    );
    
    if (locationParentFields.length === 0) {
      return;
    }
    
    let geocodedCount = 0;
    
    // Recursive helper to find ALL fields matching predicate in nested subFields
    const findAllFieldsRecursive = (fields: any[], predicate: (f: any) => boolean): any[] => {
      const results: any[] = [];
      for (const f of fields) {
        if (predicate(f)) results.push(f);
        if (f.subFields && f.subFields.length > 0) {
          results.push(...findAllFieldsRecursive(f.subFields, predicate));
        }
      }
      return results;
    };
    
    // Helper to extract array index from field ID (e.g., "schema:location[1].geo.latitude" -> 1)
    const getArrayIndex = (fieldId: string): number => {
      const match = fieldId.match(/\[(\d+)\]/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    for (const parentField of locationParentFields) {
      const subFields = parentField.subFields!;
      
      // Find ALL latitude fields (there may be multiple for different array items)
      const allLatFields = findAllFieldsRecursive(subFields, sf => sf.fieldId.includes('latitude'));
      
      // Group fields by array index
      const locationIndices = new Set<number>();
      allLatFields.forEach(f => locationIndices.add(getArrayIndex(f.fieldId)));
      
      // Process each location entry separately
      for (const arrayIndex of locationIndices) {
        // Find fields for this specific array index
        const matchesIndex = (fieldId: string) => {
          const fieldIndex = getArrayIndex(fieldId);
          return fieldIndex === arrayIndex;
        };
        
        const streetField = findAllFieldsRecursive(subFields, sf => 
          sf.fieldId.includes('streetAddress') && matchesIndex(sf.fieldId))[0];
        const postalField = findAllFieldsRecursive(subFields, sf => 
          sf.fieldId.includes('postalCode') && matchesIndex(sf.fieldId))[0];
        const localityField = findAllFieldsRecursive(subFields, sf => 
          sf.fieldId.includes('addressLocality') && matchesIndex(sf.fieldId))[0];
        const regionField = findAllFieldsRecursive(subFields, sf => 
          sf.fieldId.includes('addressRegion') && matchesIndex(sf.fieldId))[0];
        const countryField = findAllFieldsRecursive(subFields, sf => 
          sf.fieldId.includes('addressCountry') && matchesIndex(sf.fieldId))[0];
        const latField = findAllFieldsRecursive(subFields, sf => 
          sf.fieldId.includes('latitude') && matchesIndex(sf.fieldId))[0];
        const lonField = findAllFieldsRecursive(subFields, sf => 
          sf.fieldId.includes('longitude') && matchesIndex(sf.fieldId))[0];
        
        // Check if we have address data for this location
        const hasAddress = (streetField?.value || postalField?.value || localityField?.value);
        
        if (!hasAddress) {
          continue;
        }
        
        // Skip if geo coordinates already exist for this location
        if (latField?.value && lonField?.value) {
          continue;
        }
        
        if (!latField || !lonField) {
          continue;
        }
        
        // Build address object
        const address: any = {
          streetAddress: streetField?.value || '',
          postalCode: postalField?.value || '',
          addressLocality: localityField?.value || '',
          addressRegion: regionField?.value || '',
          addressCountry: countryField?.value || ''
        };
        
        try {
          const geoResult = await this.geocodingService.geocodeAddress(address);
          
          if (geoResult) {
            // Update latitude field
            this.updateFieldStatus(latField.fieldId, FieldStatus.FILLED, geoResult.latitude, 1.0);
            this.updateMetadata(latField.fieldId, geoResult.latitude);
            
            // Update longitude field
            this.updateFieldStatus(lonField.fieldId, FieldStatus.FILLED, geoResult.longitude, 1.0);
            this.updateMetadata(lonField.fieldId, geoResult.longitude);
            
            // Also update region and country if returned by geocoding API
            if (geoResult.enrichedAddress?.addressRegion && regionField && !regionField.value) {
              this.updateFieldStatus(regionField.fieldId, FieldStatus.FILLED, geoResult.enrichedAddress.addressRegion, 1.0);
              this.updateMetadata(regionField.fieldId, geoResult.enrichedAddress.addressRegion);
            }
            if (geoResult.enrichedAddress?.addressCountry && countryField && !countryField.value) {
              this.updateFieldStatus(countryField.fieldId, FieldStatus.FILLED, geoResult.enrichedAddress.addressCountry, 1.0);
              this.updateMetadata(countryField.fieldId, geoResult.enrichedAddress.addressCountry);
            }
            
            geocodedCount++;
          }
        } catch (error) {
          console.error(`❌ Geocoding failed:`, error);
        }
      }
    }
    
  }

  /**
   * Ensure core schema is loaded and cached (call on app init)
   */
  async ensureCoreSchemaLoaded(): Promise<void> {
    // Check if already cached
    const cached = this.schemaLoader.getCachedSchema('core.json');
    if (cached) {
      return;
    }
    
    // Load schema and wait for completion
    try {
      const schema = await this.schemaLoader.loadSchema('core.json').toPromise();
      if (schema) {
        } else {
        }
    } catch (err) {
      console.error('❌ Failed to pre-load core schema:', err);
    }
  }

  /**
   * Re-localize all fields when language changes
   */
  async relocalizeAllFields(language: 'de' | 'en'): Promise<void> {
    const currentState = this.getCurrentState();
    
    // Skip if no fields exist yet (nothing to re-localize)
    if (currentState.coreFields.length === 0 && currentState.specialFields.length === 0) {
      return;
    }
    
    // Check if core schema is cached
    const coreSchema = this.schemaLoader.getCachedSchema('core.json');
    if (!coreSchema) {
      return;
    }
    
    // Re-localize core fields (create completely new objects for change detection)
    const localizedCoreFields = currentState.coreFields.map(field => {
      // Get field definition from cached schema
      const fieldDef = coreSchema?.fields?.find((f: any) => f.id === field.fieldId);
      
      if (fieldDef) {
        const localized = this.localizer.localizeField(fieldDef, language);
        // Create new object with all properties (deep copy for nested objects)
        return {
          ...field,
          label: localized.label || field.label,
          description: localized.description || field.description,
          vocabulary: localized.vocabulary ? { ...localized.vocabulary, concepts: [...(localized.vocabulary.concepts || [])] } : field.vocabulary,
          groupLabel: field.group ? this.getLocalizedGroupLabel(field.group, 'core.json', language) : field.groupLabel,
          subFields: field.subFields ? [...field.subFields] : undefined
        };
      }
      // Return new object even if no localization
      return { ...field };
    });
    
    // Re-localize special fields (create completely new objects)
    let localizedSpecialFields = currentState.specialFields.map(field => ({ ...field }));
    if (currentState.selectedContentType) {
      const schemaName = currentState.selectedContentType;
      const schema = this.schemaLoader.getCachedSchema(schemaName);
      localizedSpecialFields = currentState.specialFields.map(field => {
        const fieldDef = schema?.fields?.find((f: any) => f.id === field.fieldId);
        
        if (fieldDef) {
          const localized = this.localizer.localizeField(fieldDef, language);
          // Create new object with all properties (deep copy for nested objects)
          return {
            ...field,
            label: localized.label || field.label,
            description: localized.description || field.description,
            vocabulary: localized.vocabulary ? { ...localized.vocabulary, concepts: [...(localized.vocabulary.concepts || [])] } : field.vocabulary,
            groupLabel: field.group ? this.getLocalizedGroupLabel(field.group, schemaName, language) : field.groupLabel,
            subFields: field.subFields ? [...field.subFields] : undefined
          };
        }
        // Return new object even if no localization
        return { ...field };
      });
    }
    
    // Re-localize field groups (create completely new objects)
    const localizedFieldGroups = currentState.fieldGroups.map((group, groupIdx) => {
      // Normalize schema name: add .json if missing, convert to lowercase
      const normalizedSchemaName = group.schemaName.toLowerCase().endsWith('.json') 
        ? group.schemaName.toLowerCase() 
        : `${group.schemaName.toLowerCase()}.json`;
      
      const localizedGroupLabel = this.getLocalizedGroupLabel(group.id, normalizedSchemaName, language);
      
      return {
        ...group,
        label: localizedGroupLabel,
        fields: group.fields.map((field, fieldIdx) => {
          const schema = this.schemaLoader.getCachedSchema(normalizedSchemaName);
          const fieldDef = schema?.fields?.find((f: any) => f.id === field.fieldId);
          
          // Debug first group's first field
          if (groupIdx === 0 && fieldIdx === 0) {
            }
          
          if (fieldDef) {
            const localized = this.localizer.localizeField(fieldDef, language);
            
            // Debug first group's first field
            if (groupIdx === 0 && fieldIdx === 0) {
              }
            
            // Create new object with all properties (deep copy for nested objects)
            return {
              ...field,
              label: localized.label || field.label,
              description: localized.description || field.description,
              vocabulary: localized.vocabulary ? { ...localized.vocabulary, concepts: [...(localized.vocabulary.concepts || [])] } : field.vocabulary,
              groupLabel: localizedGroupLabel,  // Use the localized group label
              subFields: field.subFields ? [...field.subFields] : undefined
            };
          }
          
          // Debug if field def not found
          if (groupIdx === 0 && fieldIdx === 0) {
            }
          
          // Return new object with localized group label even if no field localization
          return { ...field, groupLabel: localizedGroupLabel };
        })
      };
    });
    
    // Update state with NEW array references (important for OnPush change detection)
    const updatedState: Partial<CanvasState> = {
      coreFields: [...localizedCoreFields],
      specialFields: [...localizedSpecialFields],
      fieldGroups: [...localizedFieldGroups]
    };
    
    this.updateState(updatedState);
    
    // Force state emission by getting current state and emitting again
    const newState = this.getCurrentState();
    this.stateSubject.next(newState);
    
    }
  
  /**
   * Get localized group label
   */
  private getLocalizedGroupLabel(groupId: string, schemaName: string, language: 'de' | 'en'): string {
    const schema = this.schemaLoader.getCachedSchema(schemaName);
    const group = schema?.groups?.find((g: any) => g.id === groupId);
    
    if (group?.label) {
      return this.localizer.localizeString(group.label, language) || groupId;
    }
    
    // Fallback: use groupId as label
    return groupId;
  }

  /**
   * Reset state
   */
  reset(): void {
    this.workerPool.clearQueue();
    this.stateSubject.next(this.getInitialState());
  }

  /**
   * Import JSON data and pre-fill fields
   * Compact format: { metadataset, schemaVersion, fieldId: { value, repoField } }
   */
  async importJsonData(jsonData: any): Promise<void> {
    try {
      // Step 1: Initialize with correct schema
      await this.initializeCoreFields();

      // Step 2: Load schema from metadataset
      let schemaFileToLoad: string | null = jsonData.metadataset || null;
      
      // Ensure .json extension
      if (schemaFileToLoad && !schemaFileToLoad.endsWith('.json')) {
        schemaFileToLoad = `${schemaFileToLoad}.json`;
      }

      // Load the schema (without triggering updateCanvasFields via fillContentTypeField)
      if (schemaFileToLoad) {
        try {
          await this.loadSpecialSchema(schemaFileToLoad);
        } catch (error) {
          console.error('❌ Failed to load schema:', schemaFileToLoad, error);
        }
      }

      // Step 3: Map JSON data to fields
      const state = this.getCurrentState();
      const allFields = [...state.coreFields, ...state.specialFields];
      const fieldUpdates: { [key: string]: CanvasFieldState } = {};
      
      // Fill content type field directly (to avoid triggering updateCanvasFields prematurely)
      if (schemaFileToLoad) {
        const contentTypeField = state.coreFields.find(f => f.fieldId === 'ccm:oeh_flex_lrt');
        if (contentTypeField?.vocabulary) {
          const concept = contentTypeField.vocabulary.concepts.find((c: any) => c.schema_file === schemaFileToLoad);
          if (concept) {
            fieldUpdates['ccm:oeh_flex_lrt'] = {
              ...contentTypeField,
              value: { schema_file: concept.schema_file, uri: concept.uri, label: concept.label },
              status: FieldStatus.FILLED
            };
          }
        }
      }
      
      for (const field of allFields) {
        const fieldData = jsonData[field.fieldId];
        
        // Skip if field not in JSON
        if (fieldData === undefined || fieldData === null) continue;
        
        // Compact format: value is stored directly (not wrapped in {value: ...})
        const jsonValue = fieldData;
        
        // Get schema definition for complex object handling
        const schemaName = field.schemaName === 'Core' ? 'core.json' : (schemaFileToLoad || state.selectedContentType);
        const schema = schemaName ? this.schemaLoader.getCachedSchema(schemaName) : null;
        const schemaFieldDef = schema?.fields?.find((f: any) => f.id === field.fieldId);
        
        // Check if this is a complex object (array of objects, nested structure)
        const hasVariants = schemaFieldDef?.system?.items?.variants;
        const hasShape = field.shape || schemaFieldDef?.system?.items?.shape;
        const isComplexObject = (hasShape || hasVariants) && 
                                (typeof jsonValue === 'object' || Array.isArray(jsonValue));
        
        if (isComplexObject) {
          // Use ShapeExpander to create sub-fields
          const subFields = this.shapeExpander.expandFieldWithShape(field, jsonValue, schemaFieldDef);
          
          if (subFields.length > 0) {
            fieldUpdates[field.fieldId] = {
              ...field,
              value: jsonValue,
              status: 'filled' as FieldStatus,
              isParent: true,
              subFields: subFields
            };
            
            subFields.forEach(subField => {
              fieldUpdates[subField.fieldId] = subField;
            });
          } else {
            fieldUpdates[field.fieldId] = {
              ...field,
              value: jsonValue,
              status: 'filled' as FieldStatus
            };
          }
        } else {
          // Simple field
          fieldUpdates[field.fieldId] = {
            ...field,
            value: jsonValue,
            status: 'filled' as FieldStatus
          };
        }
      }

      // Step 4: Apply updates
      const updatedCoreFields = state.coreFields.map(f => fieldUpdates[f.fieldId] || f);
      const updatedSpecialFields = state.specialFields.map(f => fieldUpdates[f.fieldId] || f);
      
      // Collect sub-fields
      const allSubFields: CanvasFieldState[] = [];
      [...updatedCoreFields, ...updatedSpecialFields].forEach(field => {
        if (field.isParent && field.subFields) {
          allSubFields.push(...field.subFields);
        }
      });

      // Update state - count only top-level fields (excluding ccm:oeh_flex_lrt)
      const topLevelFields = [...updatedCoreFields, ...updatedSpecialFields];
      const countableFields = topLevelFields.filter(f => f.fieldId !== 'ccm:oeh_flex_lrt');
      
      const filledCount = countableFields
        .filter(f => {
          const v = f.value;
          if (v === undefined || v === null || v === '') return false;
          if (Array.isArray(v) && v.length === 0) return false;
          // Skip arrays with only empty objects
          if (Array.isArray(v) && v.every((item: any) => 
            typeof item === 'object' && item !== null && Object.keys(item).length === 0)) return false;
          return true;
        }).length;
      
      const progress = countableFields.length > 0 
        ? Math.round((filledCount / countableFields.length) * 100)
        : 0;
      
      this.updateState({
        coreFields: updatedCoreFields,
        specialFields: updatedSpecialFields,
        fieldGroups: this.groupFields(topLevelFields),
        filledFields: filledCount,
        totalFields: countableFields.length,
        detectedContentType: schemaFileToLoad,
        selectedContentType: schemaFileToLoad,
        isExtracting: false,
        extractionProgress: progress
      });

    } catch (error) {
      console.error('❌ Error importing JSON:', error);
      throw error;
    }
  }


  /**
   * Export current state as compact JSON
   * Values are stored directly without wrapper (repoField comes from schema on import)
   */
  exportAsJson(): any {
    const state = this.getCurrentState();
    const allFields = [...state.coreFields, ...state.specialFields];
    const currentLanguage = this.i18n.getCurrentLanguage();
    
    // Header with schema info
    const output: any = {
      metadataset: state.selectedContentType || 'core.json',
      schemaVersion: '1.8.0',
      exportedAt: new Date().toISOString(),
      language: currentLanguage
    };

    // Build set of sub-field IDs to exclude (they're in parent's value)
    const subFieldIds = new Set<string>();
    allFields.forEach(field => {
      if (field.isParent && field.subFields) {
        field.subFields.forEach((sf: any) => subFieldIds.add(sf.fieldId));
      }
    });

    // Export all fields - values directly without wrapper
    for (const field of allFields) {
      // Skip sub-fields - they're reconstructed into parent objects
      if (subFieldIds.has(field.fieldId)) continue;
      
      let fieldValue = field.value;

      // Reconstruct complex objects from sub-fields
      if (field.isParent && field.subFields && field.subFields.length > 0) {
        fieldValue = this.shapeExpander.reconstructObjectFromSubFields(field, allFields);
      }

      // Skip empty values
      if (fieldValue === null || fieldValue === undefined || fieldValue === '') continue;
      if (Array.isArray(fieldValue) && fieldValue.length === 0) continue;
      // Skip arrays with only empty objects
      if (Array.isArray(fieldValue) && fieldValue.every(v => 
        typeof v === 'object' && v !== null && Object.keys(v).length === 0)) continue;

      // Compact format: value directly (repoField from schema on import)
      output[field.fieldId] = fieldValue;
    }

    return output;
  }

  /**
   * Extract all field paths from variant fields (recursive for nested fields)
   */
  private extractPathsFromVariantFields(fields: any[], prefix: string = ''): string[] {
    const paths: string[] = [];
    
    fields.forEach((fieldDef: any) => {
      const fieldPath = prefix ? `${prefix}.${fieldDef.id}` : fieldDef.id;
      paths.push(fieldPath);
      
      // Recursively extract nested field paths
      if (fieldDef.fields && Array.isArray(fieldDef.fields) && fieldDef.fields.length > 0) {
        const nestedPaths = this.extractPathsFromVariantFields(fieldDef.fields, fieldPath);
        paths.push(...nestedPaths);
      }
    });
    
    return paths;
  }

  /**
   * Get current metadata for LLM context (for incremental updates)
   */
  getCurrentMetadataContext(): string {
    const state = this.getCurrentState();
    const allFields = [...state.coreFields, ...state.specialFields];
    
    const filledFields = allFields
      .filter(f => f.value !== undefined && f.value !== null && f.value !== '')
      .map(f => {
        let valueStr = f.value;
        if (Array.isArray(f.value)) {
          valueStr = f.value.join(', ');
        } else if (typeof f.value === 'object') {
          valueStr = JSON.stringify(f.value);
        }
        return `${f.label}: ${valueStr}`;
      });

    if (filledFields.length === 0) {
      return '';
    }

    return `\n\nAktueller Metadaten-Stand:\n${filledFields.join('\n')}`;
  }
}
