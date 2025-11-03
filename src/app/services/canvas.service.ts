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
    console.log('🚀 Starting canvas extraction...');

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

      console.log('✅ Canvas extraction complete');
      
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
    
    console.log('📚 Loaded Core groups:', groups);
    console.log('📚 GroupMap:', Array.from(groupMap.entries()));
    console.log('📚 GroupOrderMap:', Array.from(groupOrderMap.entries()));

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
        
        console.log(`🔍 Field ${field.id}: group="${groupId}", group_label="${field.group_label}", resolved="${groupLabel}", order=${groupOrder}`);
        
        const localizedField = this.localizer.localizeField(field, language);

        return {
          fieldId: field.id,
          uri: field.system?.uri || field.id,
          group: groupId,
          groupLabel: String(groupLabel),
          groupOrder: groupOrder,
          schemaName: 'Core',
          aiFillable: field.system?.ai_fillable !== false,
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
          shape: field.system?.items?.shape,  // Extract complex object structure
          examples: localizedField.examples,
          prompt: localizedField.prompt,
          promptInstructions: field.promptInstructions || undefined
        };
      });

    // Group fields
    const fieldGroups = this.groupFields(coreFields);
    // Initialize metadata template
    const template = await this.schemaLoader.getOutputTemplate('core.json').toPromise();

    this.updateState({
      coreFields: coreFields,
      fieldGroups: fieldGroups,
      totalFields: coreFields.length,
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
      const value = concept.uri || concept.label;
      this.updateFieldStatus('ccm:oeh_flex_lrt', FieldStatus.FILLED, value, state.contentTypeConfidence);
      this.updateMetadata('ccm:oeh_flex_lrt', value);
      console.log(`✅ Content type field filled: ${concept.label}`);
    }
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
          
          console.log(`📋 Content type detected: ${result.schema} (${Math.round(result.confidence * 100)}%) - ${result.reason}`);
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

    console.log(`⚡ Extracting ${tasks.length} core fields in parallel...`);

    const promises = tasks.map(task => this.extractSingleField(task));
    await Promise.all(promises);
  }

  /**
   * Load special schema
   */
  private async loadSpecialSchema(schemaFile: string): Promise<void> {
    console.log(`📥 Loading special schema: ${schemaFile}`);

    const specialSchemaFields = await this.schemaLoader.getFields(schemaFile).toPromise();
    if (!specialSchemaFields) return;

    const groups = await this.schemaLoader.getGroups(schemaFile).toPromise();
    const language = this.localizer.getActiveLanguage();
    const groupMap = new Map(
      (groups || []).map((g: any) => [g.id, this.localizer.localizeString(g.label, language)])
    );
    const groupOrderMap = new Map(groups?.map((g: any, index: number) => [g.id, index]) || []);
    
    console.log(`📚 Loaded ${schemaFile} groups:`, groups);
    console.log(`📚 GroupMap for ${schemaFile}:`, Array.from(groupMap.entries()));
    console.log(`📚 GroupOrderMap for ${schemaFile}:`, Array.from(groupOrderMap.entries()));

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
        
        console.log(`🔍 ${schemaFile} Field ${field.id}: group="${groupId}", group_label="${field.group_label}", resolved="${groupLabel}", order=${groupOrder}`);
        
        const localizedField = this.localizer.localizeField(field, language);

        return {
          fieldId: field.id,
          uri: field.system?.uri || field.id,
          group: groupId,
          groupLabel: String(groupLabel),
          groupOrder: groupOrder,
          schemaName: schemaName,
          aiFillable: field.system?.ai_fillable !== false,
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
          shape: field.system?.items?.shape,  // Extract complex object structure
          examples: localizedField.examples,
          prompt: localizedField.prompt,
          promptInstructions: field.promptInstructions || undefined
        };
      });

    const state = this.getCurrentState();
    const allFields = [...state.coreFields, ...specialFields];
    const fieldGroups = this.groupFields(allFields);

    // Merge template
    const template = await this.schemaLoader.getOutputTemplate(schemaFile).toPromise();
    const mergedMetadata = { ...state.metadata, ...(template || {}) };

    this.updateState({
      specialFields: specialFields,
      fieldGroups: fieldGroups,
      totalFields: allFields.length,
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

    console.log(`⚡ Extracting ${tasks.length} special fields in parallel...`);

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
          
          // Create sub-fields for fields with shape (complex objects)
          if (effectiveTask.field.shape) {
            console.log(`🏗️ Creating sub-fields for ${result.fieldId} (has shape)`);
            const subFields = this.shapeExpander.expandFieldWithShape(effectiveTask.field, result.value);
            
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
              
              console.log(`✅ Created ${subFields.length} sub-fields for ${result.fieldId}`);
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
    const state = this.getCurrentState();
    
    // Create NEW arrays with updated field (wichtig für Change Detection!)
    const updatedCoreFields = state.coreFields.map(f => {
      if (f.fieldId === fieldId) {
        const updated = { ...f };  // Clone field
        updated.status = status;
        if (value !== undefined) updated.value = value;
        if (confidence !== undefined) updated.confidence = confidence;
        if (error) updated.extractionError = error;
        console.log(`🔄 Updated field ${fieldId}:`, { status, value, confidence });
        return updated;
      }
      return f;
    });

    const updatedSpecialFields = state.specialFields.map(f => {
      if (f.fieldId === fieldId) {
        const updated = { ...f };  // Clone field
        updated.status = status;
        if (value !== undefined) updated.value = value;
        if (confidence !== undefined) updated.confidence = confidence;
        if (error) updated.extractionError = error;
        console.log(`🔄 Updated field ${fieldId}:`, { status, value, confidence });
        return updated;
      }
      return f;
    });

    const allFields = [...updatedCoreFields, ...updatedSpecialFields];
    
    // Recalculate filled fields
    const filledFields = allFields.filter(f => f.status === FieldStatus.FILLED).length;
    const extractionProgress = (filledFields / state.totalFields) * 100;

    // Regroup fields
    const fieldGroups = this.groupFields(allFields);

    this.updateState({
      coreFields: updatedCoreFields,  // NEUE Arrays!
      specialFields: updatedSpecialFields,
      fieldGroups: fieldGroups,
      filledFields: filledFields,
      extractionProgress: extractionProgress
    });
  }

  /**
   * Update metadata object
   */
  private updateMetadata(fieldId: string, value: any): void {
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
    
    console.log('📦 Created field groups (sorted by schema + order):');
    result.forEach((g, index) => {
      console.log(`  ${index + 1}. ${g.label} (${g.schemaName}, order=${g.order}) - ${g.fields.length} fields:`);
      g.fields.forEach(f => {
        console.log(`     - ${f.fieldId} (status: ${f.status}, hasShape: ${!!f.shape})`);
      });
    });
    
    return result;
  }

  /**
   * User manually changes a field value
   */
  updateFieldValue(fieldId: string, value: any): void {
    console.log(`📝 updateFieldValue called for ${fieldId}:`, value);
    
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
      console.warn(`⚠️ Field not found for normalization: ${fieldId}`);
      return;
    }

    console.log(`👤 User updated field ${fieldId}:`, {
      value,
      datatype: field.datatype,
      hasVocabulary: !!field.vocabulary,
      vocabularyType: field.vocabulary?.type,
      hasShape: !!field.shape
    });
    
    // Check if this is an address field change - trigger re-geocoding
    if (this.isAddressField(fieldId)) {
      console.log(`🗺️ Address field changed, will trigger re-geocoding after update`);
      // Defer geocoding to allow the value to be set first
      setTimeout(() => this.triggerReGeocoding(fieldId), 100);
    }

    // Skip normalization for structured fields (fields with shape definition)
    // These should keep their object structure intact
    if (field.shape || field.datatype === 'object') {
      console.log(`🏗️ Skipping normalization for structured field ${fieldId} (has shape or is object type)`);
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
          console.warn(`⚠️ Invalid value rejected for ${field.vocabulary?.type} vocabulary: "${value}"`);
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
          console.log(`✅ Field ${fieldId} normalized:`, value, '→', normalizedValue);
          
          // Special handling for arrays: Check if items were removed
          if (Array.isArray(value) && Array.isArray(normalizedValue)) {
            if (normalizedValue.length < value.length) {
              const removedItems = value.filter(v => !normalizedValue.includes(v));
              console.warn(`⚠️ Removed invalid items from ${fieldId}:`, removedItems);
            }
          }
        } else {
          console.log(`ℹ️ Field ${fieldId} unchanged after normalization`);
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

    console.log(`🤖 Normalizing AI-extracted value for ${fieldId}:`, {
      value,
      datatype: field.datatype,
      hasVocabulary: !!field.vocabulary,
      vocabularyType: field.vocabulary?.type,
      isRetry
    });

    // Skip normalization for structured fields (fields with shape definition)
    if (field.shape || field.datatype === 'object') {
      console.log(`🏗️ Skipping normalization for structured field ${fieldId} (has shape or is object type)`);
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
            console.warn(`⚠️ AI extraction failed vocabulary validation for ${fieldId}: "${value}"`);
            
            // Retry ONCE if this is the first attempt
            if (!isRetry) {
              console.log(`🔄 Retrying extraction for ${fieldId} with stricter prompt...`);
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
            console.log(`✅ AI value ${fieldId} normalized:`, value, '→', normalizedValue);
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
    console.log(`🔄 Retrying field extraction (Versuch ${nextAttempt}) mit strengerem Prompt: ${task.field.label}`);
    
    if (task.field.vocabulary) {
      const vocabSample = task.field.vocabulary.concepts
        .slice(0, 10)
        .map(c => c.label)
        .join(', ');
      console.log(`📋 Beispiel erlaubter Labels (Top 10): ${vocabSample}`);
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
    console.log('🔄 Manual content type change requested:', schemaFile);
    
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
      console.log('🔄 Re-extracting special fields with new schema...');
      await this.extractSpecialFields(state.userText);
    }
    
    console.log('✅ Content type change complete (confidence: 100% - manual selection)');
  }

  /**
   * Handle content type change (automatic during extraction)
   */
  private async onContentTypeChange(contentType: string | string[]): Promise<void> {
    console.log('🔄 Content type changed:', contentType);

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
   * Get metadata for Browser-Plugin in Repository-API format
   * Converts {label, uri} objects to URI strings only
   */
  getMetadataForPlugin(): Record<string, any> {
    const state = this.getCurrentState();
    const allFields = [...state.coreFields, ...state.specialFields];
    
    // Create a map of fieldId to field object
    const fieldMap = new Map<string, any>();
    allFields.forEach(field => {
      fieldMap.set(field.fieldId, field);
    });
    
    // Build a set of sub-field IDs to exclude from output
    const subFieldIds = new Set<string>();
    allFields.forEach(field => {
      if (field.isParent && field.subFields) {
        field.subFields.forEach((sf: any) => subFieldIds.add(sf.fieldId));
      }
    });
    
    // Build output in Repository-API format
    const output: Record<string, any> = {};
    
    Object.keys(state.metadata).forEach(fieldId => {
      const value = state.metadata[fieldId];
      const field = fieldMap.get(fieldId);
      
      // Skip sub-fields
      if (subFieldIds.has(fieldId)) {
        return;
      }
      
      if (!field) {
        output[fieldId] = value;
        return;
      }
      
      // Check if field has sub-fields (complex object)
      if (field.isParent && field.subFields && field.subFields.length > 0) {
        const reconstructedValue = this.shapeExpander.reconstructObjectFromSubFields(field, allFields);
        output[fieldId] = reconstructedValue;
        return;
      }
      
      // Convert vocabulary values: {label, uri} → uri string
      if (field.vocabulary && field.vocabulary.concepts && field.vocabulary.concepts.length > 0) {
        if (Array.isArray(value)) {
          // Array: Extract URIs from each {label, uri} object
          output[fieldId] = value
            .filter(v => v !== null && v !== undefined && v !== '')
            .map(v => {
              if (typeof v === 'object' && v.uri) {
                return v.uri; // Already {label, uri} format
              }
              // Find URI from vocabulary
              const concept = field.vocabulary.concepts.find((c: any) => 
                c.uri === v || c.label === v || (c.altLabels && c.altLabels.includes(v))
              );
              return concept ? concept.uri : v;
            });
        } else if (value !== null && value !== undefined && value !== '') {
          // Single value: Extract URI
          if (typeof value === 'object' && value.uri) {
            output[fieldId] = [value.uri]; // Repository expects array
          } else {
            // Find URI from vocabulary
            const concept = field.vocabulary.concepts.find((c: any) => 
              c.uri === value || c.label === value || (c.altLabels && c.altLabels.includes(value))
            );
            output[fieldId] = concept ? [concept.uri] : [value];
          }
        } else {
          output[fieldId] = [];
        }
      } else {
        // Non-vocabulary field: use as-is, but ensure arrays
        if (field.multiple && !Array.isArray(value)) {
          output[fieldId] = value ? [value] : [];
        } else if (!field.multiple && Array.isArray(value)) {
          output[fieldId] = value.length > 0 ? value[0] : null;
        } else {
          output[fieldId] = value;
        }
      }
    });
    
    console.log('📦 Metadata prepared for Plugin (Repository format)');
    return output;
  }

  /**
   * Get metadata JSON with URI and label information
   * For vocabulary-based fields: returns array of {label, uri} pairs
   * For free-text fields: returns just the value
   */
  getMetadataJson(): string {
    const state = this.getCurrentState();
    const allFields = [...state.coreFields, ...state.specialFields];
    
    // Create a map of fieldId to field object
    const fieldMap = new Map<string, any>();
    allFields.forEach(field => {
      fieldMap.set(field.fieldId, field);
    });
    
    // Build a set of sub-field IDs to exclude from output
    const subFieldIds = new Set<string>();
    allFields.forEach(field => {
      if (field.isParent && field.subFields) {
        field.subFields.forEach((sf: any) => subFieldIds.add(sf.fieldId));
      }
    });
    
    // Build enriched output
    const enrichedOutput: Record<string, any> = {};
    
    Object.keys(state.metadata).forEach(fieldId => {
      const value = state.metadata[fieldId];
      const field = fieldMap.get(fieldId);
      
      // Skip sub-fields - they will be reconstructed into parent objects
      if (subFieldIds.has(fieldId)) {
        console.log(`⏭️ Skipping sub-field ${fieldId} (will be included in parent object)`);
        return;
      }
      
      if (!field) {
        // Fallback: field not found (shouldn't happen)
        enrichedOutput[fieldId] = value;
        return;
      }
      
      // Check if field has sub-fields (complex object with shape)
      if (field.isParent && field.subFields && field.subFields.length > 0) {
        // Always reconstruct from current sub-field values
        // This ensures we get the latest values (including geocoded data)
        console.log(`🔧 Reconstructing object for ${fieldId} from ${field.subFields.length} sub-fields`);
        const reconstructedValue = this.shapeExpander.reconstructObjectFromSubFields(field, allFields);
        enrichedOutput[fieldId] = reconstructedValue;
        return;
      }
      
      // Check if field has a vocabulary (controlled values)
      if (field.vocabulary && field.vocabulary.concepts && field.vocabulary.concepts.length > 0) {
        // Field with vocabulary: Map values to {label, uri} pairs
        if (Array.isArray(value)) {
          // Multiple values: map each to {label, uri}
          enrichedOutput[fieldId] = value
            .filter(v => v !== null && v !== undefined && v !== '')
            .map(v => this.mapValueToLabelUri(v, field.vocabulary.concepts));
        } else if (value !== null && value !== undefined && value !== '') {
          // Single value: map to {label, uri}
          enrichedOutput[fieldId] = this.mapValueToLabelUri(value, field.vocabulary.concepts);
        } else {
          // Empty value
          enrichedOutput[fieldId] = field.multiple ? [] : null;
        }
      } else {
        // Field without vocabulary: just use the value as-is
        enrichedOutput[fieldId] = value;
      }
    });
    
    return JSON.stringify(enrichedOutput, null, 2);
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
    console.warn(`⚠️ Value "${value}" not found in vocabulary concepts`);
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

    console.log('🗺️ Starting geocoding enrichment...');

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
        console.log(`🔧 Reconstructing ${fieldId} from sub-fields before geocoding...`);
        value = this.shapeExpander.reconstructObjectFromSubFields(field, allFields);
        metadata[fieldId] = value; // Update metadata with reconstructed value
      }

      if (!value) {
        continue; // Field not present or empty
      }

      console.log(`🔍 Checking ${fieldId}:`, value);

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
      console.log(`✅ Geocoding enrichment complete: ${geocodedCount} locations geocoded`);
      // Update metadata in state
      this.updateState({ metadata });
    } else {
      console.log('ℹ️ No new locations geocoded (addresses may already have coordinates or no addresses found)');
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
   */
  private async triggerReGeocoding(fieldId: string): Promise<void> {
    console.log(`🗺️ Re-geocoding triggered by field change: ${fieldId}`);
    
    const state = this.getCurrentState();
    const allFields = [...state.coreFields, ...state.specialFields];
    
    // Find the parent location field for this address field
    let parentField: any = null;
    for (const field of allFields) {
      if (field.isParent && field.subFields) {
        const hasThisSubField = field.subFields.some((sf: any) => sf.fieldId === fieldId);
        if (hasThisSubField) {
          parentField = field;
          break;
        }
      }
    }
    
    if (!parentField) {
      console.log(`⚠️ Could not find parent location field for ${fieldId}`);
      return;
    }
    
    console.log(`📍 Found parent field: ${parentField.fieldId}`);
    
    const subFields = parentField.subFields!;
    
    // Build address from current sub-field values
    const streetField = subFields.find((sf: any) => sf.fieldId.includes('streetAddress'));
    const postalField = subFields.find((sf: any) => sf.fieldId.includes('postalCode'));
    const localityField = subFields.find((sf: any) => sf.fieldId.includes('addressLocality'));
    const regionField = subFields.find((sf: any) => sf.fieldId.includes('addressRegion'));
    const countryField = subFields.find((sf: any) => sf.fieldId.includes('addressCountry'));
    
    // Find geo coordinate fields
    const latField = subFields.find((sf: any) => sf.fieldId.includes('latitude'));
    const lonField = subFields.find((sf: any) => sf.fieldId.includes('longitude'));
    
    // Check if we have enough address data
    const hasAddress = (streetField?.value || postalField?.value || localityField?.value);
    
    if (!hasAddress) {
      console.log(`⏭️ Not enough address data for geocoding`);
      return;
    }
    
    if (!latField || !lonField) {
      console.log(`⚠️ Missing lat/lon fields`);
      return;
    }
    
    const address: any = {
      streetAddress: streetField?.value || '',
      postalCode: postalField?.value || '',
      addressLocality: localityField?.value || '',
      addressRegion: regionField?.value || '',
      addressCountry: countryField?.value || ''
    };
    
    console.log(`🌍 Re-geocoding address:`, address);
    
    try {
      const geoResult = await this.geocodingService.geocodeAddress(address);
      
      if (geoResult) {
        // Update latitude/longitude
        latField.value = geoResult.latitude;
        latField.status = FieldStatus.FILLED;
        lonField.value = geoResult.longitude;
        lonField.status = FieldStatus.FILLED;
        
        // Update region and country if returned
        if (geoResult.enrichedAddress?.addressRegion && regionField && !regionField.value) {
          regionField.value = geoResult.enrichedAddress.addressRegion;
          regionField.status = FieldStatus.FILLED;
        }
        if (geoResult.enrichedAddress?.addressCountry && countryField && !countryField.value) {
          countryField.value = geoResult.enrichedAddress.addressCountry;
          countryField.status = FieldStatus.FILLED;
        }
        
        // Trigger UI update
        const currentState = this.getCurrentState();
        this.updateState({ 
          coreFields: [...currentState.coreFields],
          specialFields: [...currentState.specialFields]
        });
        
        console.log(`✅ Re-geocoded: ${address.addressLocality} → ${geoResult.latitude}, ${geoResult.longitude}`);
      }
    } catch (error) {
      console.error(`❌ Re-geocoding failed:`, error);
    }
  }

  /**
   * Auto-enrich with geocoding after extraction
   * Fills empty geo fields (latitude/longitude) automatically
   */
  private async autoEnrichWithGeocoding(): Promise<void> {
    console.log('🗺️ Auto-enriching with geocoding...');
    
    const state = this.getCurrentState();
    const allFields = [...state.coreFields, ...state.specialFields];
    
    // Find location parent fields (schema:location, schema:address, schema:legalAddress)
    const locationParentFields = allFields.filter(f => 
      (f.fieldId === 'schema:location' || f.fieldId === 'schema:address' || f.fieldId === 'schema:legalAddress') 
      && f.isParent 
      && f.subFields 
      && f.subFields.length > 0
    );
    
    console.log(`📍 Found ${locationParentFields.length} location parent fields with sub-fields`);
    
    if (locationParentFields.length === 0) {
      console.log('ℹ️ No location fields with sub-fields found');
      return;
    }
    
    let geocodedCount = 0;
    
    for (const parentField of locationParentFields) {
      console.log(`\n🔍 Processing ${parentField.fieldId} (${parentField.subFields!.length} sub-fields)`);
      
      const subFields = parentField.subFields!;
      
      // Find address sub-fields
      const streetField = subFields.find(sf => sf.fieldId.includes('streetAddress'));
      const postalField = subFields.find(sf => sf.fieldId.includes('postalCode'));
      const localityField = subFields.find(sf => sf.fieldId.includes('addressLocality'));
      const regionField = subFields.find(sf => sf.fieldId.includes('addressRegion'));
      const countryField = subFields.find(sf => sf.fieldId.includes('addressCountry'));
      
      // Find geo coordinate fields
      const latField = subFields.find(sf => sf.fieldId.includes('latitude'));
      const lonField = subFields.find(sf => sf.fieldId.includes('longitude'));
      
      console.log(`   📬 Address fields:`, {
        street: `${streetField?.fieldId} = ${streetField?.value}`,
        postal: `${postalField?.fieldId} = ${postalField?.value}`,
        locality: `${localityField?.fieldId} = ${localityField?.value}`,
        region: `${regionField?.fieldId} = ${regionField?.value}`,
        country: `${countryField?.fieldId} = ${countryField?.value}`
      });
      
      console.log(`   🗺️ Geo fields:`, {
        lat: `${latField?.fieldId} = ${latField?.value}`,
        lon: `${lonField?.fieldId} = ${lonField?.value}`
      });
      
      // Check if we have address data
      const hasAddress = (streetField?.value || postalField?.value || localityField?.value);
      
      if (!hasAddress) {
        console.log(`   ⏭️ Skipping: No address data`);
        continue;
      }
      
      // Skip if geo coordinates already exist
      if (latField?.value && lonField?.value) {
        console.log(`   ⏭️ Skipping: Geo coordinates already present`);
        continue;
      }
      
      if (!latField || !lonField) {
        console.log(`   ⚠️ Missing latitude/longitude fields`);
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
      
      console.log(`   🌍 Geocoding address:`, address);
      
      try {
        const geoResult = await this.geocodingService.geocodeAddress(address);
        
        if (geoResult) {
          console.log(`   🎯 Updating fields:`, {
            latFieldId: latField.fieldId,
            lonFieldId: lonField.fieldId,
            latValue: geoResult.latitude,
            lonValue: geoResult.longitude
          });
          
          // Update latitude/longitude directly in field's value property
          latField.value = geoResult.latitude;
          latField.status = FieldStatus.FILLED;
          lonField.value = geoResult.longitude;
          lonField.status = FieldStatus.FILLED;
          
          // Also update region and country if returned by geocoding API
          if (geoResult.enrichedAddress?.addressRegion && regionField && !regionField.value) {
            regionField.value = geoResult.enrichedAddress.addressRegion;
            regionField.status = FieldStatus.FILLED;
            console.log(`   📍 Added region: ${geoResult.enrichedAddress.addressRegion}`);
          }
          if (geoResult.enrichedAddress?.addressCountry && countryField && !countryField.value) {
            countryField.value = geoResult.enrichedAddress.addressCountry;
            countryField.status = FieldStatus.FILLED;
            console.log(`   📍 Added country: ${geoResult.enrichedAddress.addressCountry}`);
          }
          
          // Trigger state update to refresh UI
          const currentState = this.getCurrentState();
          this.updateState({ 
            coreFields: [...currentState.coreFields],
            specialFields: [...currentState.specialFields]
          });
          
          geocodedCount++;
          console.log(`   ✅ Geocoded: ${address.addressLocality} → ${geoResult.latitude}, ${geoResult.longitude}`);
        } else {
          console.log(`   ⚠️ Geocoding returned no result`);
        }
      } catch (error) {
        console.error(`   ❌ Geocoding failed:`, error);
      }
    }
    
    if (geocodedCount > 0) {
      console.log(`\n✅ Auto-geocoding complete: ${geocodedCount} locations geocoded`);
    } else {
      console.log('\nℹ️ No locations geocoded');
    }
  }

  /**
   * Ensure core schema is loaded and cached (call on app init)
   */
  async ensureCoreSchemaLoaded(): Promise<void> {
    // Check if already cached
    const cached = this.schemaLoader.getCachedSchema('core.json');
    if (cached) {
      console.log('✅ Core schema already cached');
      return;
    }
    
    // Load schema and wait for completion
    console.log('📥 Pre-loading core.json schema for i18n...');
    try {
      const schema = await this.schemaLoader.loadSchema('core.json').toPromise();
      if (schema) {
        console.log('✅ Core schema cached successfully');
      } else {
        console.warn('⚠️ Core schema loaded but is null/undefined');
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
    
    console.log(`🌐 Re-localizing all fields to ${language}...`);
    
    // Check if core schema is cached
    const coreSchema = this.schemaLoader.getCachedSchema('core.json');
    if (!coreSchema) {
      console.warn('⚠️ Core schema not cached during re-localization. This should not happen if ensureCoreSchemaLoaded() was called.');
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
            console.log(`🔍 Group 0 Field 0 (${field.fieldId}):`, {
              originalSchemaName: group.schemaName,
              normalizedSchemaName: normalizedSchemaName,
              schemaCached: !!schema,
              fieldDefFound: !!fieldDef,
              currentLabel: field.label,
              targetLanguage: language
            });
          }
          
          if (fieldDef) {
            const localized = this.localizer.localizeField(fieldDef, language);
            
            // Debug first group's first field
            if (groupIdx === 0 && fieldIdx === 0) {
              console.log(`   Localized:`, {
                localizedLabel: localized.label,
                willUse: localized.label || field.label
              });
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
            console.warn(`   ⚠️ Field definition not found in schema!`);
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
    
    console.log(`✅ Fields re-localized to ${language}:`, {
      coreFields: localizedCoreFields.length,
      specialFields: localizedSpecialFields.length,
      fieldGroups: localizedFieldGroups.length,
      sampleCoreField: localizedCoreFields[0]?.label,
      sampleSpecialField: localizedSpecialFields[0]?.label
    });
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
   */
  async importJsonData(jsonData: any, detectedSchema?: string): Promise<void> {
    console.log('📂 Importing JSON data...', { detectedSchema });

    try {
      // Step 1: Initialize with correct schema
      await this.initializeCoreFields();

      // Step 2: If content type detected, load special schema
      let contentTypeValue: string | null = null;
      
      if (detectedSchema && detectedSchema.includes('event')) {
        contentTypeValue = 'event';
        try {
          await this.loadSpecialSchema('event.json');
          this.fillContentTypeField('event.json');
        } catch (error) {
          console.warn('Could not load event schema, continuing with core only:', error);
        }
      } else if (detectedSchema && detectedSchema.includes('tool')) {
        contentTypeValue = 'tool';
        try {
          await this.loadSpecialSchema('tool.json');
          this.fillContentTypeField('tool.json');
        } catch (error) {
          console.warn('Could not load tool schema, continuing with core only:', error);
        }
      }

      // Step 3: Map JSON data to fields
      const state = this.getCurrentState();
      const allFields = [...state.coreFields, ...state.specialFields];
      
      let importedCount = 0;
      const fieldUpdates: { [key: string]: CanvasFieldState } = {};

      for (const field of allFields) {
        const jsonValue = this.findValueInJson(jsonData, field.fieldId);
        
        if (jsonValue !== undefined && jsonValue !== null) {
          // Check if this field has a shape (complex object with sub-fields)
          if (field.shape && (typeof jsonValue === 'object' || Array.isArray(jsonValue))) {
            console.log(`🏗️ Creating sub-fields for ${field.fieldId} during import (has shape)`);
            
            // Use ShapeExpander to create sub-fields from the imported value
            const subFields = this.shapeExpander.expandFieldWithShape(field, jsonValue);
            
            if (subFields.length > 0) {
              // Mark parent as having sub-fields
              const updatedField: CanvasFieldState = {
                ...field,
                value: jsonValue,
                status: 'filled' as FieldStatus,
                isParent: true,
                subFields: subFields
              };
              
              fieldUpdates[field.fieldId] = updatedField;
              
              // Add all sub-fields to updates
              subFields.forEach(subField => {
                fieldUpdates[subField.fieldId] = subField;
              });
              
              importedCount++;
              console.log(`✅ Created ${subFields.length} sub-fields for ${field.fieldId}`);
            }
          } else {
            // Regular field without shape
            const updatedField: CanvasFieldState = {
              ...field,
              value: jsonValue,
              status: 'filled' as FieldStatus
            };
            
            fieldUpdates[field.fieldId] = updatedField;
            importedCount++;
          }
        }
      }

      // Step 4: Apply all field updates and collect sub-fields
      const updatedCoreFields = state.coreFields.map(f => fieldUpdates[f.fieldId] || f);
      const updatedSpecialFields = state.specialFields.map(f => fieldUpdates[f.fieldId] || f);
      
      // Collect all sub-fields from updated fields
      const allSubFields: CanvasFieldState[] = [];
      [...updatedCoreFields, ...updatedSpecialFields].forEach(field => {
        if (field.isParent && field.subFields) {
          allSubFields.push(...field.subFields);
        }
      });

      // Step 5: Update field groups with imported values (including sub-fields for display)
      const allFieldsWithSubFields = [...updatedCoreFields, ...updatedSpecialFields, ...allSubFields];
      const updatedFieldGroups = this.groupFields(allFieldsWithSubFields);

      // Count filled fields (only top-level fields, not sub-fields)
      const topLevelFields = [...updatedCoreFields, ...updatedSpecialFields];
      const filledCount = topLevelFields
        .filter(f => f.value !== undefined && f.value !== null && f.value !== '' && 
                     (!Array.isArray(f.value) || f.value.length > 0)).length;

      // Calculate progress based on filled fields
      const progress = topLevelFields.length > 0 
        ? Math.round((filledCount / topLevelFields.length) * 100)
        : 0;

      this.updateState({
        coreFields: updatedCoreFields,
        specialFields: updatedSpecialFields,
        fieldGroups: updatedFieldGroups,
        filledFields: filledCount,
        totalFields: topLevelFields.length,  // Only count top-level fields
        detectedContentType: contentTypeValue,
        selectedContentType: contentTypeValue,
        isExtracting: false,
        extractionProgress: progress  // Calculate based on actual filled fields
      });

      console.log(`✅ JSON imported: ${importedCount} fields pre-filled`);
    } catch (error) {
      console.error('❌ Error importing JSON:', error);
      throw error;
    }
  }

  /**
   * Find value in JSON by field ID
   */
  private findValueInJson(jsonData: any, fieldId: string): any {
    let value: any = undefined;

    // Direct property match
    if (jsonData[fieldId] !== undefined) {
      value = jsonData[fieldId];
    } else {
      // Try common namespace prefixes
      const prefixes = ['ccm:', 'cclom:', 'cm:'];
      for (const prefix of prefixes) {
        const key = prefix + fieldId;
        if (jsonData[key] !== undefined) {
          value = jsonData[key];
          break;
        }
      }

      // Try without namespace
      if (value === undefined) {
        const withoutNamespace = fieldId.replace(/^(ccm:|cclom:|cm:)/, '');
        if (jsonData[withoutNamespace] !== undefined) {
          value = jsonData[withoutNamespace];
        }
      }
    }

    // Convert repository format to simple values
    if (value !== undefined) {
      value = this.normalizeRepositoryValue(value);
    }

    return value;
  }

  /**
   * Normalize repository format values to simple types
   * Repository format: {type, key, item_id} or [{type, key, item_id}, ...]
   * BUT: Preserve complex objects with shape (subfields)
   */
  private normalizeRepositoryValue(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Array of values
    if (Array.isArray(value)) {
      const normalized = value.map(item => {
        // If it's a repository wrapper object (not a complex shape object)
        if (this.isRepositoryWrapperObject(item)) {
          // Extract key or item_id
          return item.key || item.item_id || item;
        }
        // Keep complex objects (shapes) as-is
        return item;
      });
      return normalized;
    }

    // Single repository wrapper object (not a complex shape object)
    if (this.isRepositoryWrapperObject(value)) {
      return value.key || value.item_id || value;
    }

    // Keep complex objects (shapes) as-is
    return value;
  }

  /**
   * Check if value is a repository wrapper object (not a complex shape)
   * Repository wrappers have: type, key, item_id
   * Complex shapes have: @type, price, url, etc. (business logic fields)
   */
  private isRepositoryWrapperObject(value: any): boolean {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    // If it has @type (schema.org type), it's a complex shape, not a wrapper
    if ('@type' in value) {
      return false;
    }

    // Check if it looks like a repository wrapper
    const hasRepositoryKeys = ('key' in value || 'item_id' in value) && 'type' in value;
    
    // Make sure it doesn't have business logic fields (shape indicators)
    const hasShapeFields = 'price' in value || 'url' in value || 'serviceType' in value || 'description' in value;
    
    return hasRepositoryKeys && !hasShapeFields;
  }

  /**
   * Export current state as JSON
   */
  exportAsJson(): any {
    const state = this.getCurrentState();
    const allFields = [...state.coreFields, ...state.specialFields];
    
    const metadata: any = {
      metadataset: 'mds_oeh'
    };

    // Add content type if selected
    if (state.selectedContentType) {
      metadata.metadataset = `mds_oeh_${state.selectedContentType}`;
    }

    // Add all filled fields
    for (const field of allFields) {
      if (field.value !== undefined && field.value !== null && field.value !== '') {
        metadata[field.fieldId] = field.value;
      }
    }

    return metadata;
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
