import { Injectable } from '@angular/core';
import { CanvasFieldState, FieldStatus } from '../models/canvas-models';
import { SchemaLocalizerService } from './schema-localizer.service';

/**
 * Service to expand fields with complex shapes into editable sub-fields
 * Handles nested objects like Place with address, geo coordinates, etc.
 */
@Injectable({
  providedIn: 'root'
})
export class ShapeExpanderService {

  constructor(private localizer: SchemaLocalizerService) {}

  /**
   * Expand a field with shape definition into sub-fields
   * Uses full schema definitions from variants for i18n, validation, normalization
   * @param parentField The parent field with shape/variants definition
   * @param extractedValue The extracted value (array of objects or single object)
   * @param schemaFieldDef The full field definition from schema (with variants)
   * @returns Array of sub-fields that can be edited individually
   */
  expandFieldWithShape(parentField: CanvasFieldState, extractedValue: any, schemaFieldDef?: any): CanvasFieldState[] {
    if (!parentField.shape && !schemaFieldDef?.system?.items?.variants) {
      console.log(`⚠️ No shape or variants found for ${parentField.fieldId}`);
      return [];
    }

    console.log(`🔍 Expanding field ${parentField.fieldId}:`, {
      extractedValueType: Array.isArray(extractedValue) ? `array[${extractedValue.length}]` : typeof extractedValue,
      extractedValueSample: Array.isArray(extractedValue) ? extractedValue[0] : extractedValue,
      hasVariants: !!(schemaFieldDef?.system?.items?.variants),
      variantsCount: schemaFieldDef?.system?.items?.variants?.length || 0
    });

    const subFields: CanvasFieldState[] = [];
    const language = this.localizer.getActiveLanguage();

    // Handle array of objects (e.g., multiple locations)
    if (Array.isArray(extractedValue)) {
      extractedValue.forEach((item, index) => {
        const itemSubFields = this.createSubFieldsFromObject(
          parentField,
          item,
          index,
          parentField.shape || schemaFieldDef,
          schemaFieldDef,
          language
        );
        subFields.push(...itemSubFields);
      });
    } else if (typeof extractedValue === 'object' && extractedValue !== null) {
      // Handle single object
      const itemSubFields = this.createSubFieldsFromObject(
        parentField,
        extractedValue,
        0,
        parentField.shape || schemaFieldDef,
        schemaFieldDef,
        language
      );
      subFields.push(...itemSubFields);
    }

    console.log(`✅ Created ${subFields.length} sub-fields for ${parentField.fieldId}`);
    return subFields;
  }

  /**
   * Create sub-fields from a single object using full schema definitions
   */
  private createSubFieldsFromObject(
    parentField: CanvasFieldState,
    objectValue: any,
    arrayIndex: number,
    shapeDefinition: any,
    schemaFieldDef: any,
    language: 'de' | 'en'
  ): CanvasFieldState[] {
    const subFields: CanvasFieldState[] = [];

    console.log(`   📋 createSubFieldsFromObject for ${parentField.fieldId}[${arrayIndex}]:`, {
      objectValueType: typeof objectValue,
      objectValueKeys: typeof objectValue === 'object' && objectValue ? Object.keys(objectValue) : 'not object',
      hasVariants: !!(schemaFieldDef?.system?.items?.variants)
    });

    // NEW: Use variants from schema if available (preferred)
    if (schemaFieldDef?.system?.items?.variants) {
      const variants = schemaFieldDef.system.items.variants;
      
      console.log(`      Found ${variants.length} variants, matching against objectValue`);
      
      // Find matching variant based on @type or first variant
      const matchedVariant = this.findMatchingVariant(objectValue, variants) || variants[0];
      
      console.log(`      Matched variant:`, matchedVariant?.['@type'] || 'first variant', `with ${matchedVariant?.fields?.length || 0} fields`);
      
      if (matchedVariant?.fields) {
        // Use full schema field definitions with recursive expansion
        matchedVariant.fields.forEach((fieldDef: any) => {
          const fieldValue = objectValue[fieldDef.id];
          this.expandFieldRecursively(
            parentField,
            fieldDef,
            fieldValue,
            '',
            arrayIndex,
            language,
            subFields
          );
        });
      }
    } else {
      // FALLBACK: Old logic for backwards compatibility
      let activeShape = shapeDefinition;
      if (shapeDefinition.oneOf && Array.isArray(shapeDefinition.oneOf)) {
        const matchedShape = this.findMatchingShape(objectValue, shapeDefinition.oneOf);
        activeShape = matchedShape || shapeDefinition.oneOf[0];
      }

      Object.keys(activeShape).forEach(key => {
        if (key === 'oneOf' || key === '@type') return;

        const propertyDef = activeShape[key];
        const propertyValue = objectValue[key];

        if (typeof propertyDef === 'object' && !Array.isArray(propertyDef)) {
          const nestedKeys = Object.keys(propertyDef);
          if (nestedKeys.length > 0 && nestedKeys[0] !== 'type') {
            Object.keys(propertyDef).forEach(nestedKey => {
              const nestedValue = propertyValue && typeof propertyValue === 'object' 
                ? propertyValue[nestedKey] 
                : null;

              const subField = this.createSubField(
                parentField,
                `${key}.${nestedKey}`,
                this.formatLabel(nestedKey),
                propertyDef[nestedKey],
                nestedValue,
                arrayIndex
              );
              subFields.push(subField);
            });
            return;
          }
        }

        const subField = this.createSubField(
          parentField,
          key,
          this.formatLabel(key),
          propertyDef,
          propertyValue,
          arrayIndex
        );
        subFields.push(subField);
      });
    }

    return subFields;
  }

  /**
   * Recursively expand a field and all its nested fields
   * Supports unlimited nesting depth
   * 
   * This method is fully compatible with buildObjectFromFields():
   * - Export: buildObjectFromFields() creates { address: { streetAddress: "..." } }
   * - Import: expandFieldRecursively() reads that structure and creates sub-fields
   * 
   * The bidirectional compatibility ensures data integrity across save/load cycles.
   */
  private expandFieldRecursively(
    parentField: CanvasFieldState,
    fieldDef: any,
    fieldValue: any,
    pathPrefix: string,
    arrayIndex: number,
    language: 'de' | 'en',
    subFields: CanvasFieldState[]
  ): void {
    // Build the full path for this field
    const fullPath = pathPrefix ? `${pathPrefix}.${fieldDef.id}` : fieldDef.id;
    
    console.log(`🔄 expandFieldRecursively: path="${fullPath}", valueType=${typeof fieldValue}, hasNestedFields=${!!(fieldDef.fields && fieldDef.fields.length > 0)}`);
    if (typeof fieldValue === 'object' && fieldValue !== null && !Array.isArray(fieldValue)) {
      console.log(`   Value keys:`, Object.keys(fieldValue));
    }
    
    // Create sub-field for this level
    const subField = this.createSubFieldFromSchema(
      parentField,
      fullPath,
      fieldDef,
      fieldValue,
      arrayIndex,
      language
    );
    subFields.push(subField);
    console.log(`   ✅ Created sub-field: ${subField.fieldId}, value=${subField.value}, status=${subField.status}`);
    
    // If this field has nested fields, recursively expand them
    if (fieldDef.fields && Array.isArray(fieldDef.fields) && fieldDef.fields.length > 0) {
      console.log(`   🔽 Expanding ${fieldDef.fields.length} nested fields...`);
      fieldDef.fields.forEach((nestedFieldDef: any) => {
        const nestedValue = fieldValue && typeof fieldValue === 'object'
          ? fieldValue[nestedFieldDef.id]
          : null;
        
        console.log(`      Looking for "${nestedFieldDef.id}" in fieldValue:`, nestedValue);
        
        // Recursive call for nested field
        this.expandFieldRecursively(
          parentField,
          nestedFieldDef,
          nestedValue,
          fullPath,  // Pass current path as prefix
          arrayIndex,
          language,
          subFields
        );
      });
    }
  }

  /**
   * Find which variant matches the object based on @type
   */
  private findMatchingVariant(objectValue: any, variants: any[]): any {
    if (objectValue['@type']) {
      const match = variants.find(v => v['@type'] === objectValue['@type']);
      if (match) return match;
    }
    return variants[0]; // Default to first variant
  }

  /**
   * Find which shape definition matches the object based on @type or properties
   */
  private findMatchingShape(objectValue: any, oneOfShapes: any[]): any {
    // Try to match by @type
    if (objectValue['@type']) {
      const match = oneOfShapes.find(shape => shape['@type'] === objectValue['@type']);
      if (match) return match;
    }

    // Try to match by available properties (best match)
    let bestMatch = oneOfShapes[0];
    let maxMatches = 0;

    oneOfShapes.forEach(shape => {
      const shapeKeys = Object.keys(shape).filter(k => k !== '@type' && k !== 'oneOf');
      const objectKeys = Object.keys(objectValue);
      const matches = shapeKeys.filter(k => objectKeys.includes(k)).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = shape;
      }
    });

    return bestMatch;
  }

  /**
   * Create sub-field from full schema definition (NEW)
   */
  private createSubFieldFromSchema(
    parentField: CanvasFieldState,
    propertyPath: string,
    fieldDef: any,
    value: any,
    arrayIndex: number,
    language: 'de' | 'en'
  ): CanvasFieldState {
    const fullPath = arrayIndex > 0 
      ? `${parentField.fieldId}[${arrayIndex}].${propertyPath}`
      : `${parentField.fieldId}.${propertyPath}`;

    // Use schema definitions with i18n
    const label = this.localizer.localizeString(fieldDef.label, language) || this.formatLabel(fieldDef.id);
    const description = this.localizer.localizeString(fieldDef.description, language) || '';
    const datatype = fieldDef.system?.datatype || 'string';
    const isRequired = fieldDef.system?.required || false;
    const aiFillable = fieldDef.system?.ai_fillable !== false;

    // Check if this field has nested fields (making it a container)
    const hasNestedFields = fieldDef.fields && Array.isArray(fieldDef.fields) && fieldDef.fields.length > 0;

    return {
      fieldId: fullPath,
      uri: fieldDef.system?.uri || `${parentField.uri}#${propertyPath}`,
      label: label,
      description: description,
      group: parentField.group,
      groupLabel: parentField.groupLabel,
      groupOrder: parentField.groupOrder,
      schemaName: parentField.schemaName,
      aiFillable: aiFillable,
      repoField: parentField.repoField,  // Inherit from parent
      status: value !== null && value !== undefined ? FieldStatus.FILLED : FieldStatus.EMPTY,
      value: value,
      confidence: value !== null && value !== undefined ? 1.0 : 0,
      isRequired: isRequired,
      datatype: datatype,
      multiple: fieldDef.system?.multiple || false,
      parentFieldId: parentField.fieldId,
      path: propertyPath,
      arrayIndex: arrayIndex,
      // Mark as parent if it has nested fields
      isParent: hasNestedFields,
      // NEW: Add validation, normalization, vocabulary from schema
      validation: fieldDef.system?.validation,
      normalization: fieldDef.system?.normalization,
      vocabulary: fieldDef.system?.vocabulary ? 
        this.localizer.localizeVocabulary(fieldDef.system.vocabulary, language) : undefined
    };
  }

  /**
   * Create a single sub-field (OLD - for backwards compatibility)
   */
  private createSubField(
    parentField: CanvasFieldState,
    propertyPath: string,
    label: string,
    typeDef: any,
    value: any,
    arrayIndex: number
  ): CanvasFieldState {
    const datatype = this.inferDatatype(typeDef);
    const fullPath = arrayIndex > 0 
      ? `${parentField.fieldId}[${arrayIndex}].${propertyPath}`
      : `${parentField.fieldId}.${propertyPath}`;

    return {
      fieldId: fullPath,
      uri: `${parentField.uri}#${propertyPath}`,
      label: label,
      description: `Sub-field of ${parentField.label}`,
      repoField: parentField.repoField,  // Inherit from parent
      group: parentField.group,
      groupLabel: parentField.groupLabel,
      groupOrder: parentField.groupOrder,
      schemaName: parentField.schemaName,
      aiFillable: false,
      status: value !== null && value !== undefined ? FieldStatus.FILLED : FieldStatus.EMPTY,
      value: value,
      confidence: value !== null && value !== undefined ? 1.0 : 0,
      isRequired: false,
      datatype: datatype,
      multiple: false,
      parentFieldId: parentField.fieldId,
      path: propertyPath,
      arrayIndex: arrayIndex
    };
  }

  /**
   * Infer datatype from shape definition
   */
  private inferDatatype(typeDef: any): string {
    if (typeof typeDef === 'string') {
      switch (typeDef) {
        case 'string': return 'string';
        case 'number': return 'number';
        case 'integer': return 'integer';
        case 'boolean': return 'boolean';
        case 'uri': return 'uri';
        case 'url': return 'url';
        case 'date': return 'date';
        default: return 'string';
      }
    }
    return 'string';
  }

  /**
   * Format property key to readable label with i18n support
   */
  private formatLabel(key: string): string {
    const language = this.localizer.getActiveLanguage();
    
    // i18n translation map for common field names
    const translations: { [key: string]: { de: string, en: string } } = {
      'contactType': { de: 'Kontakttyp', en: 'Contact Type' },
      'email': { de: 'E-Mail', en: 'Email' },
      'telephone': { de: 'Telefon', en: 'Telephone' },
      'faxNumber': { de: 'Faxnummer', en: 'Fax Number' },
      'availableLanguage': { de: 'Verfügbare Sprachen', en: 'Available Language' },
      'name': { de: 'Name', en: 'Name' },
      'value': { de: 'Wert', en: 'Value' },
      'description': { de: 'Beschreibung', en: 'Description' },
      'streetAddress': { de: 'Straße und Hausnummer', en: 'Street Address' },
      'postalCode': { de: 'Postleitzahl', en: 'Postal Code' },
      'addressLocality': { de: 'Stadt', en: 'City' },
      'addressRegion': { de: 'Bundesland/Region', en: 'State/Region' },
      'addressCountry': { de: 'Land', en: 'Country' },
      'address': { de: 'Adresse', en: 'Address' },
      'geo': { de: 'Koordinaten', en: 'Coordinates' },
      'latitude': { de: 'Breitengrad', en: 'Latitude' },
      'longitude': { de: 'Längengrad', en: 'Longitude' },
      'sameAs': { de: 'Verweis', en: 'Reference' },
      'accessibilitySummary': { de: 'Barrierefreiheits-Übersicht', en: 'Accessibility Summary' },
      'accessibilitySupport': { de: 'Barrierefreiheits-Unterstützung', en: 'Accessibility Support' }
    };
    
    // Check if we have a translation for this key
    if (translations[key]) {
      return translations[key][language];
    }
    
    // Fallback: Convert camelCase/snake_case to Title Case
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Reconstruct object from sub-fields for JSON export
   * 
   * Complete data cycle:
   * 1. AI Extraction → expandFieldRecursively() → creates sub-fields with paths
   * 2. User Edits → sub-fields are modified
   * 3. Export → reconstructObjectFromSubFields() → rebuilds nested objects
   * 4. Import → expandFieldRecursively() → recreates sub-fields
   * 
   * Example:
   *   Sub-fields: [
   *     { path: "name", value: "metaVentis" },
   *     { path: "address.streetAddress", value: "Am Horn 21 a" },
   *     { path: "address.postalCode", value: "99425" }
   *   ]
   *   Reconstructed: {
   *     name: "metaVentis",
   *     address: { streetAddress: "Am Horn 21 a", postalCode: "99425" }
   *   }
   */
  reconstructObjectFromSubFields(
    parentField: CanvasFieldState,
    allFields: CanvasFieldState[]
  ): any {
    // Use sub-fields from parentField.subFields directly if available
    let subFields: CanvasFieldState[] = [];
    
    if (parentField.subFields && parentField.subFields.length > 0) {
      subFields = parentField.subFields;
    } else {
      // Fallback: search by parentFieldId
      subFields = allFields.filter(f => f.parentFieldId === parentField.fieldId);
    }

    if (subFields.length === 0) {
      return parentField.value; // No sub-fields, return original value
    }

    // Group by array index
    const groupedByIndex = new Map<number, CanvasFieldState[]>();
    subFields.forEach(field => {
      const index = field.arrayIndex || 0;
      if (!groupedByIndex.has(index)) {
        groupedByIndex.set(index, []);
      }
      groupedByIndex.get(index)!.push(field);
    });

    // Reconstruct each object
    const reconstructedObjects: any[] = [];
    groupedByIndex.forEach((fields, index) => {
      const obj = this.buildObjectFromFields(fields);
      reconstructedObjects.push(obj);
    });

    // Return array or single object
    return parentField.multiple ? reconstructedObjects : reconstructedObjects[0];
  }

  /**
   * Build object from flat sub-fields using paths (recursive-compatible)
   * This method reconstructs nested objects from flattened sub-fields.
   * The output can be re-imported using expandFieldRecursively().
   * 
   * Example: 
   *   Input: [{ path: "address.streetAddress", value: "Am Horn 21 a" }]
   *   Output: { address: { streetAddress: "Am Horn 21 a" } }
   * 
   * Supports unlimited nesting depth through iterative path traversal.
   */
  private buildObjectFromFields(fields: CanvasFieldState[]): any {
    const result: any = {};
    const containerPaths = new Set<string>();

    // First pass: identify all container paths (parent fields)
    fields.forEach(field => {
      if (field.path && field.path.includes('.')) {
        const pathParts = field.path.split('.');
        // Build container path from all parts except the last one
        for (let i = 1; i < pathParts.length; i++) {
          const containerPath = pathParts.slice(0, i).join('.');
          containerPaths.add(containerPath);
        }
      }
    });

    // Second pass: build the object structure
    fields.forEach(field => {
      if (!field.path) {
        return;
      }

      // Split path (e.g., "address.streetAddress" -> ["address", "streetAddress"])
      const pathParts = field.path.split('.');

      // Navigate/create nested structure up to the last part
      let current = result;
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        
        // Create nested object if it doesn't exist
        if (!current[part] || typeof current[part] !== 'object') {
          current[part] = {};
        }
        
        // Move deeper into the structure
        current = current[part];
      }

      // Set the final value at the deepest level
      const lastPart = pathParts[pathParts.length - 1];
      
      // For container fields (isParent), ensure we have at least an empty object
      // even if value is null/undefined
      if (field.isParent) {
        if (field.value === null || field.value === undefined) {
          current[lastPart] = {};
        } else if (typeof field.value === 'object' && !Array.isArray(field.value)) {
          // Preserve existing object (might have nested data)
          current[lastPart] = field.value;
        } else {
          current[lastPart] = field.value;
        }
      } else if (field.value !== null && field.value !== undefined) {
        // Only set non-null/undefined values for leaf fields
        current[lastPart] = field.value;
      }
    });

    // Ensure all container paths exist as empty objects if they don't have data
    containerPaths.forEach(containerPath => {
      const pathParts = containerPath.split('.');
      let current = result;
      for (const part of pathParts) {
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
    });

    return result;
  }
}
