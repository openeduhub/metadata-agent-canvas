/**
 * Schema Loader Service (analog to schema_loader.py)
 * Loads and manages metadata schemas with context and version support
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, shareReplay, take, BehaviorSubject, firstValueFrom } from 'rxjs';
import { SchemaField } from '../models/workflow-models';
import { SchemaLocalizerService } from './schema-localizer.service';

interface SchemaDefinition {
  fields: Array<{
    id: string;
    type: string;
    required?: boolean;
    ask_user?: boolean;
    prompt?: {
      de?: {
        label?: string;
        description?: string;
      };
    };
    values?: string[];
  }>;
}

/**
 * Schema context configuration
 */
export interface SchemaContextConfig {
  contextName: string;
  schemaVersion: string;
}

/**
 * Context registry entry
 */
interface ContextEntry {
  name: string;
  description?: string;
  defaultVersion: string;
  path: string;
  basedOn?: string;
}

/**
 * Context registry
 */
interface ContextRegistry {
  contexts: Record<string, ContextEntry>;
  defaultContext: string;
}

/**
 * Manifest entry for a context
 */
interface ContextManifest {
  contextName: string;
  name: string;
  basedOn?: string;
  versions: Record<string, {
    releaseDate: string;
    isDefault?: boolean;
    schemas: string[];
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class SchemaLoaderService {
  private schemaBasePath: string;
  private schemaCache: Map<string, any> = new Map();
  // Track pending requests to prevent duplicate HTTP calls
  private pendingRequests: Map<string, Observable<any>> = new Map();
  
  // Context and version management
  private contextRegistry: ContextRegistry | null = null;
  private contextManifests: Map<string, ContextManifest> = new Map();
  private activeContext$ = new BehaviorSubject<SchemaContextConfig>({
    contextName: 'default',
    schemaVersion: '1.8.0'
  });
  
  private registryLoaded = false;
  private registryLoadPromise: Promise<void> | null = null;

  constructor(
    private http: HttpClient,
    private localizer: SchemaLocalizerService
  ) {
    // Dynamisch Base-URL ermitteln für Cross-Origin Web Component Einbindung
    this.schemaBasePath = this.getComponentBaseUrl() + 'schemata/';
    
    // Load context registry on startup
    this.registryLoadPromise = this.loadContextRegistry();
  }
  
  /**
   * Load the context registry and manifests
   */
  private async loadContextRegistry(): Promise<void> {
    if (this.registryLoaded) return;
    
    try {
      // Load main registry
      const registryPath = `${this.schemaBasePath}context-registry.json`;
      this.contextRegistry = await firstValueFrom(
        this.http.get<ContextRegistry>(registryPath).pipe(
          catchError(err => {
            console.warn('Could not load context-registry.json, using defaults', err);
            return of({
              contexts: {
                'default': {
                  name: 'WLO/OEH Standard',
                  defaultVersion: '1.8.0',
                  path: 'default'
                }
              },
              defaultContext: 'default'
            } as ContextRegistry);
          })
        )
      );
      
      // Load manifests for all contexts
      for (const [contextName, contextEntry] of Object.entries(this.contextRegistry.contexts)) {
        try {
          const manifestPath = `${this.schemaBasePath}${contextEntry.path}/manifest.json`;
          const manifest = await firstValueFrom(
            this.http.get<ContextManifest>(manifestPath).pipe(
              catchError(() => of(null))
            )
          );
          if (manifest) {
            this.contextManifests.set(contextName, manifest);
          }
        } catch (e) {
          console.warn(`Could not load manifest for context ${contextName}`);
        }
      }
      
      this.registryLoaded = true;
      console.log('📚 Schema contexts loaded:', Object.keys(this.contextRegistry.contexts));
    } catch (error) {
      console.error('Failed to load context registry:', error);
      this.registryLoaded = true; // Prevent infinite retries
    }
  }
  
  /**
   * Ensure registry is loaded before operations
   */
  async ensureRegistryLoaded(): Promise<void> {
    if (this.registryLoadPromise) {
      await this.registryLoadPromise;
    }
  }
  
  /**
   * Set the active schema context
   * Falls back to 'default' if context doesn't exist
   */
  setContext(contextName: string, schemaVersion?: string): void {
    // Validate context exists
    let validContext = contextName;
    if (!this.hasContext(contextName)) {
      console.warn(`⚠️ Context "${contextName}" not found, falling back to "default"`);
      validContext = 'default';
    }
    
    // Validate version exists for this context
    let validVersion = schemaVersion || this.getDefaultVersion(validContext);
    const availableVersions = this.getAvailableVersions(validContext);
    if (schemaVersion && !availableVersions.includes(schemaVersion)) {
      console.warn(`⚠️ Version "${schemaVersion}" not found for context "${validContext}", using default version`);
      validVersion = this.getDefaultVersion(validContext);
    }
    
    this.activeContext$.next({ contextName: validContext, schemaVersion: validVersion });
    
    // Clear and prominent logging
    console.log(`%c📚 Schema Context Active: ${validContext} @ v${validVersion}`, 
      'background: #1976d2; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold');
    
    // Clear schema cache when context changes to force reload
    this.schemaCache.clear();
  }
  
  /**
   * Get the active schema context
   */
  getContext(): SchemaContextConfig {
    return this.activeContext$.getValue();
  }
  
  /**
   * Get context as observable
   */
  getContext$(): Observable<SchemaContextConfig> {
    return this.activeContext$.asObservable();
  }
  
  /**
   * Get default version for a context
   */
  getDefaultVersion(contextName: string): string {
    // Try from manifest first
    const manifest = this.contextManifests.get(contextName);
    if (manifest) {
      const defaultVersion = Object.entries(manifest.versions)
        .find(([_, v]) => v.isDefault)?.[0];
      if (defaultVersion) return defaultVersion;
      // Fallback to first version
      return Object.keys(manifest.versions)[0] || '1.8.0';
    }
    
    // Try from registry
    const entry = this.contextRegistry?.contexts[contextName];
    if (entry?.defaultVersion) {
      return entry.defaultVersion;
    }
    
    return '1.8.0'; // Ultimate fallback
  }
  
  /**
   * Get all available contexts
   */
  getAvailableContexts(): Array<{ name: string; contextName: string; description?: string }> {
    if (!this.contextRegistry) return [];
    return Object.entries(this.contextRegistry.contexts).map(([key, entry]) => ({
      contextName: key,
      name: entry.name,
      description: entry.description
    }));
  }
  
  /**
   * Get available versions for a context
   */
  getAvailableVersions(contextName: string): string[] {
    const manifest = this.contextManifests.get(contextName);
    if (manifest) {
      return Object.keys(manifest.versions);
    }
    return ['1.8.0'];
  }
  
  /**
   * Build the full path for a schema file based on current context
   */
  private buildSchemaPath(schemaName: string, contextOverride?: string, versionOverride?: string): string {
    const context = contextOverride || this.activeContext$.getValue().contextName;
    const version = versionOverride || this.activeContext$.getValue().schemaVersion;
    
    // Get the path from registry (might differ from contextName)
    const entry = this.contextRegistry?.contexts[context];
    const contextPath = entry?.path || context;
    
    return `${this.schemaBasePath}${contextPath}/v${version}/${schemaName}`;
  }
  
  /**
   * Get cache key for a schema (includes context and version)
   */
  private getCacheKey(schemaName: string, contextOverride?: string, versionOverride?: string): string {
    const context = contextOverride || this.activeContext$.getValue().contextName;
    const version = versionOverride || this.activeContext$.getValue().schemaVersion;
    return `${context}@${version}/${schemaName}`;
  }

  /**
   * Ermittelt die Base-URL der Web Component Scripts
   * Wichtig für Cross-Origin Einbindung auf anderen Websites
   */
  private getComponentBaseUrl(): string {
    // Versuche die URL des main.js Scripts zu finden
    const scripts = document.querySelectorAll('script[src*="main"]');
    for (const script of Array.from(scripts)) {
      const src = script.getAttribute('src');
      if (src && (src.includes('main.js') || src.includes('main.') && src.endsWith('.js'))) {
        // Extrahiere Base-URL (alles vor dem Dateinamen)
        const lastSlash = src.lastIndexOf('/');
        if (lastSlash > 0) {
          return src.substring(0, lastSlash + 1);
        }
      }
    }
    // Fallback: relativer Pfad (funktioniert wenn Same-Origin)
    return '/';
  }

  /**
   * Load a schema file (with deduplication of pending requests)
   * Uses current context and version, or explicit overrides
   */
  loadSchema(schemaName: string, contextOverride?: string, versionOverride?: string): Observable<any> {
    const cacheKey = this.getCacheKey(schemaName, contextOverride, versionOverride);
    
    // Return from cache if available
    if (this.schemaCache.has(cacheKey)) {
      return of(this.schemaCache.get(cacheKey));
    }
    
    // Return pending request if one exists (prevents duplicate HTTP calls)
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const schemaPath = this.buildSchemaPath(schemaName, contextOverride, versionOverride);
    
    // Create and store the shared request
    const request$ = this.http.get(schemaPath).pipe(
      take(1), // Ensure single emission
      map((schema: any) => {
        this.schemaCache.set(cacheKey, schema);
        this.pendingRequests.delete(cacheKey); // Clean up pending
        return schema;
      }),
      catchError((error: any) => {
        console.error(`Error loading schema ${schemaPath}:`, error);
        this.pendingRequests.delete(cacheKey); // Clean up pending
        
        // Fallback: try default context if not already using it
        const context = contextOverride || this.activeContext$.getValue().contextName;
        if (context !== 'default') {
          console.log(`⚠️ Falling back to default context for ${schemaName}`);
          return this.loadSchema(schemaName, 'default');
        }
        return of(null);
      }),
      shareReplay(1) // Share result with all subscribers
    );
    
    this.pendingRequests.set(cacheKey, request$);
    return request$;
  }

  /**
   * Get fields from a schema (returns RAW fields with ALL properties)
   */
  getFields(schemaName: string): Observable<any[]> {
    return this.loadSchema(schemaName).pipe(
      map((schema: any) => {
        if (!schema || !schema.fields) {
          return [];
        }

        // Return RAW fields - DO NOT filter properties!
        // Canvas service needs group, group_label, system, etc.
        return schema.fields;
      })
    );
  }

  /**
   * Get output template from schema
   */
  getOutputTemplate(schemaName: string): Observable<Record<string, any>> {
    return this.loadSchema(schemaName).pipe(
      map((schema: any) => {
        // Use output_template if available, otherwise build from fields
        if (schema.output_template) {
          return schema.output_template;
        }
        
        // Fallback: build from fields
        const template: Record<string, any> = {};
        if (schema.fields) {
          schema.fields.forEach((field: any) => {
            // Skip fields where BOTH ai_fillable=false AND ask_user=false
            // (no way to get information for these fields)
            const aiFillable = field.system?.ai_fillable !== false;
            const askUser = field.system?.ask_user !== false;
            
            if (!aiFillable && !askUser) {
              return; // Skip this field
            }
            
            const datatype = field.system?.datatype || 'string';
            if (datatype === 'array' || field.system?.multiple) {
              template[field.id] = [];
            } else {
              template[field.id] = null;
            }
          });
        }
        return template;
      })
    );
  }

  /**
   * Get available special schemas
   */
  getAvailableSpecialSchemas(): string[] {
    return [
      'event.json',
      'education_offer.json',
      'learning_material.json',
      'person.json',
      'organization.json',
      'tool_service.json',
      'occupation.json',
      'didactic_planning_tools.json',
      'source.json'
    ];
  }

  /**
   * Get schema descriptions for content type suggestion
   */
  getSchemaDescriptions(): Record<string, string> {
    return {
      'event.json': 'Veranstaltungen, Events, Workshops, Konferenzen, Seminare',
      'education_offer.json': 'Bildungsangebote, Kurse, Studiengänge, Lehrveranstaltungen',
      'learning_material.json': 'Lernmaterialien, Arbeitsblätter, Übungen, Tutorials',
      'person.json': 'Personen, Autoren, Experten, Referenten',
      'organization.json': 'Organisationen, Institutionen, Bildungseinrichtungen',
      'tool_service.json': 'Tools, Software, Dienste, Anwendungen',
      'occupation.json': 'Berufe, Berufsbilder, Tätigkeitsfelder',
      'didactic_planning_tools.json': 'Didaktische Planungswerkzeuge, Unterrichtsplanung',
      'source.json': 'Quellen, Referenzen, Literaturangaben'
    };
  }

  /**
   * Get content type label (localized from core.json vocabulary)
   */
  getContentTypeLabel(schemaName: string): string {
    // Try to get localized label from core.json vocabulary
    const concepts = this.getContentTypeConcepts();
    const language = this.localizer.getActiveLanguage();
    
    const concept = concepts.find(c => c.schema_file === schemaName);
    if (concept && concept.label) {
      // Label is either string or {de, en}
      if (typeof concept.label === 'string') {
        return concept.label;
      } else if (typeof concept.label === 'object') {
        return this.localizer.localizeString(concept.label, language) || schemaName;
      }
    }
    
    // Fallback to schema name without .json
    return schemaName.replace('.json', '');
  }

  /**
   * Get vocabulary concepts for content type detection (requires core schema to be cached)
   */
  getContentTypeConcepts(): Array<{ schema_file?: string; label: string; description?: string; icon?: string }> {
    const coreSchema = this.getCoreSchema();

    if (!coreSchema?.fields) {
      // Silently return empty array - schema might still be loading
      return [];
    }

    const field = coreSchema.fields.find((f: any) => f.id === 'ccm:oeh_flex_lrt');
    const concepts = field?.system?.vocabulary?.concepts;

    if (!Array.isArray(concepts)) {
      return [];
    }

    return concepts.map((concept: any) => ({
      schema_file: concept.schema_file,
      label: concept.label,
      description: concept.description,
      icon: concept.icon
    }));
  }

  /**
   * Get groups from a schema
   */
  getGroups(schemaName: string): Observable<Array<{ id: string; label: string }>> {
    return this.loadSchema(schemaName).pipe(
      map((schema: any) => {
        if (!schema || !schema.groups) {
          return [];
        }
        return schema.groups;
      })
    );
  }

  /**
   * Get cached core schema (synchronous)
   */
  getCoreSchema(): any {
    const cacheKey = this.getCacheKey('core.json');
    return this.schemaCache.get(cacheKey);
  }

  /**
   * Get cached schema (synchronous)
   */
  getCachedSchema(schemaName: string): any {
    const cacheKey = this.getCacheKey(schemaName);
    return this.schemaCache.get(cacheKey);
  }
  
  /**
   * Check if a context exists in the registry
   */
  hasContext(contextName: string): boolean {
    return this.contextRegistry?.contexts?.[contextName] !== undefined;
  }
  
  /**
   * Get context info from registry
   */
  getContextInfo(contextName: string): ContextEntry | null {
    return this.contextRegistry?.contexts?.[contextName] || null;
  }
  
  /**
   * Detect schema context from imported JSON data
   * Returns context config to use based on file content
   */
  detectContextFromJson(jsonData: any): SchemaContextConfig {
    const contextName = jsonData.contextName || 'default';
    const schemaVersion = jsonData.schemaVersion || this.getDefaultVersion(contextName);
    
    // Validate context exists, fallback to default if not
    if (!this.hasContext(contextName)) {
      console.warn(`Context "${contextName}" not found, using default`);
      return {
        contextName: 'default',
        schemaVersion: this.getDefaultVersion('default')
      };
    }
    
    return { contextName, schemaVersion };
  }
}
