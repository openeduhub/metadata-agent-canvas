/**
 * Schema Loader Service (analog to schema_loader.py)
 * Loads and manages metadata schemas
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, shareReplay, take } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class SchemaLoaderService {
  private schemaBasePath: string;
  private schemaCache: Map<string, any> = new Map();
  // Track pending requests to prevent duplicate HTTP calls
  private pendingRequests: Map<string, Observable<any>> = new Map();

  constructor(
    private http: HttpClient,
    private localizer: SchemaLocalizerService
  ) {
    // Dynamisch Base-URL ermitteln für Cross-Origin Web Component Einbindung
    this.schemaBasePath = this.getComponentBaseUrl() + 'schemata/';
    console.log('📂 Schema base path:', this.schemaBasePath);
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
   */
  loadSchema(schemaName: string): Observable<any> {
    // Return from cache if available
    if (this.schemaCache.has(schemaName)) {
      return of(this.schemaCache.get(schemaName));
    }
    
    // Return pending request if one exists (prevents duplicate HTTP calls)
    if (this.pendingRequests.has(schemaName)) {
      console.log(`⏳ Schema ${schemaName} already loading, reusing request`);
      return this.pendingRequests.get(schemaName)!;
    }

    const schemaPath = `${this.schemaBasePath}${schemaName}`;
    console.log(`📥 Loading schema: ${schemaPath}`);
    
    // Create and store the shared request
    const request$ = this.http.get(schemaPath).pipe(
      take(1), // Ensure single emission
      map((schema: any) => {
        this.schemaCache.set(schemaName, schema);
        this.pendingRequests.delete(schemaName); // Clean up pending
        return schema;
      }),
      catchError((error: any) => {
        console.error(`Error loading schema ${schemaName}:`, error);
        this.pendingRequests.delete(schemaName); // Clean up pending
        return of(null);
      }),
      shareReplay(1) // Share result with all subscribers
    );
    
    this.pendingRequests.set(schemaName, request$);
    return request$;
  }

  /**
   * Get fields from a schema (returns RAW fields with ALL properties)
   */
  getFields(schemaName: string): Observable<any[]> {
    return this.loadSchema(schemaName).pipe(
      map((schema: any) => {
        if (!schema || !schema.fields) {
          console.warn(`⚠️ Schema ${schemaName} has no fields`);
          return [];
        }

        // Return RAW fields - DO NOT filter properties!
        // Canvas service needs group, group_label, system, etc.
        console.log(`📋 Loaded ${schema.fields.length} fields from ${schemaName}`);
        
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
          console.log(`📄 Using output_template from ${schemaName}`);
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
              console.log(`⏭️ Skipping field ${field.id} in template (ai_fillable=false && ask_user=false)`);
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
    const coreSchema = this.schemaCache.get('core.json');

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
    return this.schemaCache.get('core.json');
  }

  /**
   * Get cached schema (synchronous)
   */
  getCachedSchema(schemaName: string): any {
    return this.schemaCache.get(schemaName);
  }
}
