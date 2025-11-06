# Schema Fields & Sub-Fields Architecture

**Version:** 2.1.0  
**Datum:** November 2025

---

## 📋 Übersicht

Die Metadata Agent Canvas nutzt ein **hierarchisches Field-System** mit Unterstützung für verschachtelte Felder (Sub-Fields). Diese Architektur ermöglicht die korrekte Darstellung und Bearbeitung komplexer Schema.org-Strukturen.

---

## 🏗️ Architektur

### Field-Typen

```typescript
interface CanvasFieldState {
  fieldId: string;           // Eindeutige ID (z.B. "schema:location")
  label: string;             // Lokalisiertes Label
  value: any;                // Feldwert (String, Array, Object)
  status: FieldStatus;       // 'empty' | 'filled' | 'required'
  datatype: string;          // 'string' | 'array' | 'object' | 'boolean' | etc.
  
  // Sub-Field Properties
  isParent?: boolean;        // Hat dieses Feld Sub-Fields?
  subFields?: CanvasFieldState[];  // Array von Sub-Fields
  path?: string;             // Pfad innerhalb des Parent (z.B. "address.streetAddress")
  depth?: number;            // Verschachtelungstiefe (0 = Top-Level)
  
  // Schema-Definition
  shape?: any;               // Shape-Definition aus Schema
  schemaName?: string;       // Zugehöriges Schema (Core, Organization, etc.)
}
```

---

## 🔍 Field Expansion (ShapeExpanderService)

### 1. Einfache Felder
```json
{
  "id": "schema:name",
  "datatype": "string",
  "label": { "de": "Name", "en": "Name" }
}
```
→ Keine Sub-Fields, direkter Wert

---

### 2. Shape-basierte Felder

**Schema-Definition:**
```json
{
  "id": "schema:address",
  "system": {
    "shape": {
      "streetAddress": { "type": "string" },
      "postalCode": { "type": "string" },
      "addressLocality": { "type": "string" },
      "addressRegion": { "type": "string" },
      "addressCountry": { "type": "string" }
    }
  }
}
```

**Expansion:**
```
schema:address (Parent)
├─ streetAddress (Sub-Field)
├─ postalCode (Sub-Field)
├─ addressLocality (Sub-Field)
├─ addressRegion (Sub-Field)
└─ addressCountry (Sub-Field)
```

**Code:**
```typescript
// ShapeExpanderService.expandFieldWithShape()
const subFields = this.createSubFieldsFromShape(field, shape, value);
field.isParent = true;
field.subFields = subFields;
```

---

### 3. Variant-basierte Felder

**Schema-Definition:**
```json
{
  "id": "schema:location",
  "system": {
    "items": {
      "variants": [
        {
          "name": "Place",
          "match": { "name": "*" },
          "fields": [
            { "id": "name", "type": "string" },
            { "id": "address", "type": "object", "fields": [...] },
            { "id": "geo", "type": "object", "fields": [...] }
          ]
        },
        {
          "name": "VirtualLocation",
          "match": { "url": "*" },
          "fields": [...]
        }
      ]
    }
  }
}
```

**Variant Matching:**
```typescript
// ShapeExpanderService.findMatchingVariant()
// Prüft welche Variant zu den Daten passt
const matchedVariant = variants.find(v => 
  Object.keys(v.match).some(key => value[key] !== undefined)
);
```

**Nested Expansion:**
```
schema:location[0] (Parent, Array-Item)
├─ name (Sub-Field)
├─ address (Sub-Field, Object)
│  ├─ streetAddress (Nested Sub-Field)
│  ├─ postalCode (Nested Sub-Field)
│  └─ addressLocality (Nested Sub-Field)
└─ geo (Sub-Field, Object)
   ├─ latitude (Nested Sub-Field)
   └─ longitude (Nested Sub-Field)
```

---

### 4. Array-Felder ohne Shape

**Problem (vor Fix):**
```json
{
  "id": "cclom:general_keyword",
  "datatype": "array",
  "value": ["Impressum", "Haftung", "Datenschutz"]
}
```
→ `isComplexObject = true` (weil Array)  
→ `expandFieldWithShape()` findet kein Shape  
→ `subFields.length = 0`  
→ **Feld bleibt empty** ❌

**Lösung (nach Fix):**
```typescript
// canvas.service.ts - importJsonData()
if (isComplexObject) {
  const subFields = this.shapeExpander.expandFieldWithShape(...);
  
  if (subFields.length > 0) {
    // Hat Subfelder → Parent mit Subfeldern
    field.isParent = true;
    field.subFields = subFields;
  } else {
    // NEUE LOGIK: Keine Subfelder → Normales Array-Feld!
    field.value = jsonValue;  // Wert direkt übernehmen
    field.status = 'filled';
  }
}
```
→ Array-Wert wird übernommen ✅

---

## 📤 Export mit Schema-Info

### Export-Format

```json
{
  "schema:location": {
    "value": [{
      "name": "metaVentis GmbH",
      "address": { "streetAddress": "Am Horn 21 a", ... },
      "geo": { "latitude": 50.977, "longitude": 11.339 }
    }],
    "_schema_info": {
      "hasSubFields": true,
      "hasVariants": true,
      "variantType": "Place",
      "subFieldPaths": [
        "name",
        "address",
        "address.streetAddress",
        "address.postalCode",
        "geo",
        "geo.latitude",
        "geo.longitude"
      ]
    }
  }
}
```

**Vorteile:**
- ✅ Korrekte Rekonstruktion beim Import
- ✅ Variant-Auswahl basierend auf `variantType`
- ✅ Validierung: Vergleich `subFieldPaths` mit erstellten Sub-Fields

---

## 📥 Import & Rekonstruktion

### Import-Ablauf

```typescript
// canvas.service.ts - importJsonData()

// 1. Schema-Info aus Export lesen
const schemaInfo = fieldData._schema_info;
const hasSchemaHints = schemaInfo && schemaInfo.hasSubFields;

// 2. Schema-Definition nachschlagen
const schemaFieldDef = schema?.fields?.find(f => f.id === field.fieldId);

// 3. Expansion mit Hints
const subFields = this.shapeExpander.expandFieldWithShape(
  field, 
  jsonValue, 
  schemaFieldDef  // Schema-Def für Variant-Matching
);

// 4. Validation (wenn Schema-Hints vorhanden)
if (hasSchemaHints && schemaInfo.subFieldPaths) {
  const createdPaths = subFields.map(sf => sf.path);
  const expectedPaths = schemaInfo.subFieldPaths;
  const missingPaths = expectedPaths.filter(p => !createdPaths.includes(p));
  
  if (missingPaths.length > 0) {
    console.warn(`⚠️ Missing ${missingPaths.length} subfields`, missingPaths);
  }
}
```

---

## 🎯 Field Counting & Grouping

### Korrekte Zählung

**Alle Felder (inkl. Sub-Fields):**
```typescript
const allFieldsWithSubFields = [...topLevelFields, ...allSubFields];
const totalFields = allFieldsWithSubFields.length;  // 94 für Core + Organization
```

**Nur gefüllte Felder:**
```typescript
const filledCount = allFieldsWithSubFields.filter(
  f => f.status === 'filled'
).length;
```

**Progress-Berechnung:**
```typescript
const progress = totalFields > 0 
  ? Math.round((filledCount / totalFields) * 100) 
  : 0;
```

---

### Field Grouping (nur Top-Level!)

**WICHTIG:** Nur Top-Level-Felder werden gruppiert!

```typescript
// canvas.service.ts - groupFields()
const fieldGroups = this.groupFields(topLevelFields);  // ← NICHT allFieldsWithSubFields!
```

**Warum?**
- Sub-Fields werden über `field.subFields` im Tree angezeigt
- Sonst würden Sub-Fields doppelt erscheinen (in Gruppe + im Tree)

**Beispiel:**
```
✅ RICHTIG:
  📋 Ort & Adresse (3 Felder)
    - schema:address
    - schema:legalAddress
    - schema:location (mit 13 Sub-Fields im Tree)

❌ FALSCH:
  📋 Ort & Adresse (16 Felder)  ← Zählt Sub-Fields mit!
    - schema:address
    - schema:address.streetAddress  ← Duplikat!
    - schema:address.postalCode     ← Duplikat!
```

---

## 🌍 Programmatische Lokalisierung

### Sub-Field Labels (ohne Schema-Definition)

**Problem:** Old-Style Shape-Format hat keine `label`-Properties:
```json
"shape": {
  "streetAddress": { "type": "string" }  // ← Kein label!
}
```

**Lösung:** i18n Translation Map in `ShapeExpanderService`:

```typescript
private formatLabel(key: string): string {
  const language = this.localizer.getActiveLanguage();
  
  const translations: { [key: string]: { de: string, en: string } } = {
    'contactType': { de: 'Kontakttyp', en: 'Contact Type' },
    'email': { de: 'E-Mail', en: 'Email' },
    'telephone': { de: 'Telefon', en: 'Telephone' },
    'streetAddress': { de: 'Straße und Hausnummer', en: 'Street Address' },
    'postalCode': { de: 'Postleitzahl', en: 'Postal Code' },
    'addressLocality': { de: 'Stadt', en: 'City' },
    'latitude': { de: 'Breitengrad', en: 'Latitude' },
    'longitude': { de: 'Längengrad', en: 'Longitude' },
    // ... 20+ weitere
  };
  
  return translations[key]?.[language] 
    || key.replace(/([A-Z])/g, ' $1').trim();  // Fallback: CamelCase → Title Case
}
```

---

## 🔧 Code-Referenzen

### Wichtige Services

| Service | Datei | Verantwortlich für |
|---------|-------|-------------------|
| `ShapeExpanderService` | `shape-expander.service.ts` | Sub-Field Expansion & Rekonstruktion |
| `CanvasService` | `canvas.service.ts` | Import/Export, Field State Management |
| `SchemaLoaderService` | `schema-loader.service.ts` | Schema-Definitionen laden |
| `SchemaLocalizerService` | `schema-localizer.service.ts` | Schema-Labels lokalisieren |

### Wichtige Methoden

```typescript
// ShapeExpanderService
expandFieldWithShape(field, value, schemaFieldDef)
createSubFieldsFromShape(field, shape, value)
createSubFieldsFromObject(field, objectValue, variants)
expandFieldRecursively(field, fieldDef, fieldValue, path, depth)
formatLabel(key)

// CanvasService
importJsonData(jsonData)
exportJsonData()
groupFields(fields)
```

---

## 📊 Beispiel: Complete Workflow

### 1. Schema-Definition laden
```typescript
const schema = this.schemaLoader.getCachedSchema('organization.json');
const locationField = schema.fields.find(f => f.id === 'schema:location');
```

### 2. Feld expandieren
```typescript
const subFields = this.shapeExpander.expandFieldWithShape(
  parentField, 
  locationData, 
  locationField
);
// → Erstellt 13 Sub-Fields (name, address.*, geo.*)
```

### 3. UI-Darstellung
```html
<div class="field-tree">
  <div class="parent-field">📍 Standort(e)</div>
  <div class="sub-fields">
    <div class="sub-field">├─ Name</div>
    <div class="sub-field">├─ Adresse</div>
    <div class="sub-field">│  ├─ Straße</div>
    <div class="sub-field">│  └─ PLZ</div>
    <div class="sub-field">└─ Koordinaten</div>
  </div>
</div>
```

### 4. Export mit Metadaten
```json
{
  "schema:location": {
    "value": [...],
    "_schema_info": {
      "hasSubFields": true,
      "subFieldPaths": ["name", "address", "address.streetAddress", ...]
    }
  }
}
```

### 5. Import & Validierung
```typescript
const imported = this.importJsonData(exportedJson);
// Console: ✅ Import validation: All subfields reconstructed correctly
```

---

## 🐛 Bekannte Edge Cases

### 1. Mixed Content (Array mit verschiedenen Typen)
**Problem:** `schema:location` kann sowohl `Place` als auch `VirtualLocation` enthalten  
**Lösung:** Variant-Matching für jedes Array-Element separat

### 2. Leere Objekte
**Problem:** `{ address: {} }` → Alle Sub-Fields empty  
**Status:** Funktioniert korrekt, Sub-Fields werden erstellt aber als empty markiert

### 3. Dynamische Felder
**Problem:** Felder die zur Laufzeit hinzugefügt werden (z.B. `amenityFeature`)  
**Lösung:** Shape-basierte Expansion akzeptiert beliebige Keys

---

## 📚 Siehe auch

- **[CHANGELOG.md](../CHANGELOG.md)** - Version 2.1.0 Release Notes
- **[SCHEMA_I18N.md](SCHEMA_I18N.md)** - Schema Internationalisierung
- **[shape-expander.service.ts](../src/app/services/shape-expander.service.ts)** - Implementation
- **[canvas.service.ts](../src/app/services/canvas.service.ts)** - Import/Export Logik
