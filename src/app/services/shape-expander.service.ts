import { Injectable } from '@angular/core';
import { CanvasFieldState, FieldStatus } from '../models/canvas-models';

/**
 * Service to expand fields with complex shapes into editable sub-fields
 * Handles nested objects like Place with address, geo coordinates, etc.
 */
@Injectable({
  providedIn: 'root'
})
export class ShapeExpanderService {

  /**
   * Expand a field with shape definition into sub-fields
   * @param parentField The parent field with shape definition
   * @param extractedValue The extracted value (array of objects or single object)
   * @returns Array of sub-fields that can be edited individually
   */
  expandFieldWithShape(parentField: CanvasFieldState, extractedValue: any): CanvasFieldState[] {
    if (!parentField.shape) {
      return [];
    }

    console.log(`🔍 Expanding field ${parentField.fieldId} with shape:`, parentField.shape);

    const subFields: CanvasFieldState[] = [];

    // Handle array of objects (e.g., multiple locations)
    if (Array.isArray(extractedValue)) {
      extractedValue.forEach((item, index) => {
        const itemSubFields = this.createSubFieldsFromObject(
          parentField,
          item,
          index,
          parentField.shape
        );
        subFields.push(...itemSubFields);
      });
    } else if (typeof extractedValue === 'object' && extractedValue !== null) {
      // Handle single object
      const itemSubFields = this.createSubFieldsFromObject(
        parentField,
        extractedValue,
        0,
        parentField.shape
      );
      subFields.push(...itemSubFields);
    }

    console.log(`✅ Created ${subFields.length} sub-fields for ${parentField.fieldId}`);
    return subFields;
  }

  /**
   * Create sub-fields from a single object based on shape definition
   */
  private createSubFieldsFromObject(
    parentField: CanvasFieldState,
    objectValue: any,
    arrayIndex: number,
    shapeDefinition: any
  ): CanvasFieldState[] {
    const subFields: CanvasFieldState[] = [];

    // Handle oneOf (multiple possible schemas)
    let activeShape = shapeDefinition;
    if (shapeDefinition.oneOf && Array.isArray(shapeDefinition.oneOf)) {
      // Determine which shape matches based on @type or available properties
      const matchedShape = this.findMatchingShape(objectValue, shapeDefinition.oneOf);
      activeShape = matchedShape || shapeDefinition.oneOf[0];
    }

    // Create sub-fields for each property in the shape
    Object.keys(activeShape).forEach(key => {
      if (key === 'oneOf' || key === '@type') {
        return; // Skip meta properties
      }

      const propertyDef = activeShape[key];
      const propertyValue = objectValue[key];

      // Handle nested objects (e.g., address)
      if (typeof propertyDef === 'object' && !Array.isArray(propertyDef)) {
        // Check if it's a nested object definition
        const nestedKeys = Object.keys(propertyDef);
        if (nestedKeys.length > 0 && nestedKeys[0] !== 'type') {
          // It's a nested object - create sub-fields recursively
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

      // Create simple sub-field
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

    return subFields;
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
   * Create a single sub-field
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
      group: parentField.group,
      groupLabel: parentField.groupLabel,
      groupOrder: parentField.groupOrder,
      schemaName: parentField.schemaName,
      aiFillable: false, // Sub-fields are not AI-fillable directly
      status: value !== null && value !== undefined ? FieldStatus.FILLED : FieldStatus.EMPTY,
      value: value,
      confidence: value !== null && value !== undefined ? 1.0 : 0,
      isRequired: false, // Could be enhanced from schema
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
