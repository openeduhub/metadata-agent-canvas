/**
 * Schema Loader Service (analog to schema_loader.py)
 * Loads and manages metadata schemas
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { SchemaField } from '../models/workflow-models';

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
  private schemaBasePath = '/schemata/';
  private schemaCache: Map<string, any> = new Map();

  constructor(private http: HttpClient) {}

  /**
   * Load a schema file
   */
  loadSchema(schemaName: string): Observable<any> {
    if (this.schemaCache.has(schemaName)) {
      return of(this.schemaCache.get(schemaName));
    }

    const schemaPath = `${this.schemaBasePath}${schemaName}`;
    return this.http.get(schemaPath).pipe(
      map((schema: any) => {
        this.schemaCache.set(schemaName, schema);
        return schema;
      }),
      catchError((error: any) => {
        console.error(`Error loading schema ${schemaName}:`, error);
        return of(null);
      })
    );
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
   * Get content type label
   */
  getContentTypeLabel(schemaName: string): string {
    const labels: Record<string, string> = {
      'event.json': 'Veranstaltung',
      'education_offer.json': 'Bildungsangebot',
      'learning_material.json': 'Lernmaterial',
      'person.json': 'Person',
      'organization.json': 'Organisation',
      'tool_service.json': 'Tool/Service',
      'occupation.json': 'Beruf',
      'didactic_planning_tools.json': 'Didaktisches Planungswerkzeug',
      'source.json': 'Quelle'
    };
    return labels[schemaName] || schemaName;
  }

  /**
   * Get vocabulary concepts for content type detection (requires core schema to be cached)
   */
  getContentTypeConcepts(): Array<{ schema_file?: string; label: string; description?: string; icon?: string }> {
    const coreSchema = this.schemaCache.get('core.json');

    if (!coreSchema?.fields) {
      console.warn('⚠️ Core schema not cached. Content type descriptions unavailable.');
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
