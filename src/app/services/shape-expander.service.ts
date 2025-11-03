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
      return [];
    }

    console.log(`🔍 Expanding field ${parentField.fieldId} with schema definition:`, schemaFieldDef?.system?.items?.variants);

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

    // NEW: Use variants from schema if available (preferred)
    if (schemaFieldDef?.system?.items?.variants) {
      const variants = schemaFieldDef.system.items.variants;
      
      // Find matching variant based on @type or first variant
      const matchedVariant = this.findMatchingVariant(objectValue, variants) || variants[0];
      
      if (matchedVariant?.fields) {
        // Use full schema field definitions
        matchedVariant.fields.forEach((fieldDef: any) => {
          const fieldValue = objectValue[fieldDef.id];
          
          // Handle nested fields (e.g., address with streetAddress, postalCode)
          if (fieldDef.fields && Array.isArray(fieldDef.fields)) {
            fieldDef.fields.forEach((nestedFieldDef: any) => {
              const nestedValue = fieldValue && typeof fieldValue === 'object'
                ? fieldValue[nestedFieldDef.id]
                : null;
              
              const subField = this.createSubFieldFromSchema(
                parentField,
                `${fieldDef.id}.${nestedFieldDef.id}`,
                nestedFieldDef,
                nestedValue,
                arrayIndex,
                language
              );
              subFields.push(subField);
            });
          } else {
            // Simple field
            const subField = this.createSubFieldFromSchema(
              parentField,
              fieldDef.id,
              fieldDef,
              fieldValue,
              arrayIndex,
              language
            );
            subFields.push(subField);
          }
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
   * Format property key to readable label
   */
  private formatLabel(key: string): string {
    // Convert camelCase/snake_case to Title Case
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Reconstruct object from sub-fields for JSON export
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
   * Build object from flat sub-fields using paths
   */
  private buildObjectFromFields(fields: CanvasFieldState[]): any {
    const result: any = {};

    fields.forEach(field => {
      // Skip fields without value (but allow empty strings and 0)
      if (!field.path || (field.value === null || field.value === undefined)) {
        return;
      }

      // Split path (e.g., "address.streetAddress" -> ["address", "streetAddress"])
      const pathParts = field.path.split('.');

      let current = result;
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }

      // Set the final value
      const lastPart = pathParts[pathParts.length - 1];
      current[lastPart] = field.value;
    });

    return result;
  }
}
