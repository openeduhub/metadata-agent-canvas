# Struktur für verschachtelte Schema.org Felder

**Status:** ✅ Implementiert mit vollständiger i18n-Unterstützung (Januar 2025)

## Problem

Verschachtelte Felder wie `schema:location` haben komplexe Strukturen:
```json
"items": {
  "type": "object",
  "shape": {
    "oneOf": [
      { "@type": "Place", "name": "string", ... },
      { "@type": "VirtualLocation", "url": "uri" },
      { "@type": "PostalAddress", ... }
    ]
  }
}
```

Diese Struktur benötigt:
- ✅ i18n für Labels und Beschreibungen (DE/EN)
- ✅ Validierungs-Informationen pro Feld
- ✅ Normalisierungs-Hinweise
- ✅ Prompt-Instruktionen für AI

## Vorgeschlagene Struktur

### Basis-Konzept: Nested Field Schema

Jedes verschachtelte Objekt sollte wie ein "Mini-Schema" behandelt werden mit eigenen Feldern:

```json
{
  "id": "schema:location",
  "group": "event_details",
  "label": {
    "de": "Veranstaltungsort(e)",
    "en": "Location(s)"
  },
  "description": {
    "de": "Wo findet die Veranstaltung statt?",
    "en": "Where does the event take place?"
  },
  "prompt": {
    "label": {
      "de": "Veranstaltungsort",
      "en": "Location"
    },
    "description": {
      "de": "Extrahiere physische Orte (Adresse, Geo), virtuelle Orte (URL) oder beides",
      "en": "Extract physical locations (address, geo), virtual locations (URL), or both"
    },
    "examples": {
      "de": [
        ["Hauptstraße 1, 12345 Berlin"],
        ["https://meet.example.com/room123"],
        ["Berlin, Deutschland"]
      ],
      "en": [
        ["123 Main St, New York, NY 10001"],
        ["https://meet.example.com/room123"],
        ["Berlin, Germany"]
      ]
    }
  },
  "system": {
    "path": "schema:location",
    "uri": "https://schema.org/location",
    "datatype": "array",
    "multiple": true,
    "required": false,
    "ask_user": true,
    "ai_fillable": true,
    
    "items": {
      "datatype": "object",
      "discriminator": "@type",
      
      "variants": [
        {
          "@type": "Place",
          "label": {
            "de": "Physischer Ort",
            "en": "Physical Location"
          },
          "description": {
            "de": "Gebäude, Raum oder physische Adresse",
            "en": "Building, room, or physical address"
          },
          "fields": [
            {
              "id": "name",
              "label": {
                "de": "Ortsname",
                "en": "Place Name"
              },
              "datatype": "string",
              "required": false,
              "ai_fillable": true,
              "prompt": {
                "label": { "de": "Name", "en": "Name" },
                "description": {
                  "de": "Name des Gebäudes/Orts (z.B. 'Universitätsbibliothek')",
                  "en": "Name of building/place (e.g. 'University Library')"
                }
              },
              "validation": {
                "minLength": 2,
                "maxLength": 200
              },
              "normalization": {
                "trim": true
              }
            },
            {
              "id": "address",
              "label": {
                "de": "Adresse",
                "en": "Address"
              },
              "datatype": "object",
              "required": false,
              "ai_fillable": true,
              "fields": [
                {
                  "id": "streetAddress",
                  "label": { "de": "Straße und Hausnummer", "en": "Street Address" },
                  "datatype": "string",
                  "ai_fillable": true,
                  "prompt": {
                    "description": {
                      "de": "Straßenname und Hausnummer",
                      "en": "Street name and house number"
                    }
                  },
                  "validation": { "maxLength": 100 },
                  "normalization": { "trim": true }
                },
                {
                  "id": "postalCode",
                  "label": { "de": "Postleitzahl", "en": "Postal Code" },
                  "datatype": "string",
                  "ai_fillable": true,
                  "validation": {
                    "pattern": "^[0-9]{5}$",
                    "message": {
                      "de": "Muss 5-stellige PLZ sein",
                      "en": "Must be 5-digit postal code"
                    }
                  },
                  "normalization": { "trim": true }
                },
                {
                  "id": "addressLocality",
                  "label": { "de": "Stadt", "en": "City" },
                  "datatype": "string",
                  "ai_fillable": true,
                  "normalization": { "trim": true }
                },
                {
                  "id": "addressRegion",
                  "label": { "de": "Bundesland/Region", "en": "State/Region" },
                  "datatype": "string",
                  "ai_fillable": true,
                  "normalization": { "trim": true }
                },
                {
                  "id": "addressCountry",
                  "label": { "de": "Land", "en": "Country" },
                  "datatype": "string",
                  "ai_fillable": true,
                  "prompt": {
                    "description": {
                      "de": "Ländername oder ISO-Code (z.B. 'Deutschland' oder 'DE')",
                      "en": "Country name or ISO code (e.g. 'Germany' or 'DE')"
                    }
                  },
                  "validation": {
                    "pattern": "^[A-Z]{2}$|^[A-Za-zÄÖÜäöüß\\s-]+$"
                  },
                  "normalization": { "trim": true }
                }
              ]
            },
            {
              "id": "geo",
              "label": {
                "de": "Koordinaten",
                "en": "Coordinates"
              },
              "datatype": "object",
              "required": false,
              "ai_fillable": false,
              "ask_user": false,
              "fields": [
                {
                  "id": "latitude",
                  "label": { "de": "Breitengrad", "en": "Latitude" },
                  "datatype": "number",
                  "validation": {
                    "min": -90,
                    "max": 90
                  }
                },
                {
                  "id": "longitude",
                  "label": { "de": "Längengrad", "en": "Longitude" },
                  "datatype": "number",
                  "validation": {
                    "min": -180,
                    "max": 180
                  }
                }
              ]
            }
          ]
        },
        {
          "@type": "VirtualLocation",
          "label": {
            "de": "Virtueller Ort",
            "en": "Virtual Location"
          },
          "description": {
            "de": "Online-Meeting, Webinar oder virtuelle Veranstaltung",
            "en": "Online meeting, webinar, or virtual event"
          },
          "fields": [
            {
              "id": "url",
              "label": {
                "de": "Meeting-URL",
                "en": "Meeting URL"
              },
              "datatype": "uri",
              "required": true,
              "ai_fillable": true,
              "prompt": {
                "description": {
                  "de": "Link zum Online-Meeting (z.B. Zoom, Teams, Webex)",
                  "en": "Link to online meeting (e.g. Zoom, Teams, Webex)"
                }
              },
              "validation": {
                "pattern": "^https?://.*"
              },
              "normalization": {
                "trim": true
              }
            }
          ]
        },
        {
          "@type": "PostalAddress",
          "label": {
            "de": "Postadresse",
            "en": "Postal Address"
          },
          "description": {
            "de": "Nur Adresse ohne Ortsnamen",
            "en": "Address only without place name"
          },
          "fields": [
            {
              "id": "streetAddress",
              "label": { "de": "Straße", "en": "Street" },
              "datatype": "string",
              "ai_fillable": true
            },
            {
              "id": "postalCode",
              "label": { "de": "PLZ", "en": "Postal Code" },
              "datatype": "string",
              "ai_fillable": true
            },
            {
              "id": "addressLocality",
              "label": { "de": "Stadt", "en": "City" },
              "datatype": "string",
              "ai_fillable": true
            },
            {
              "id": "addressRegion",
              "label": { "de": "Region", "en": "Region" },
              "datatype": "string",
              "ai_fillable": true
            },
            {
              "id": "addressCountry",
              "label": { "de": "Land", "en": "Country" },
              "datatype": "string",
              "ai_fillable": true
            }
          ]
        }
      ]
    }
  }
}
```

## Vorteile dieser Struktur

### 1. Vollständige i18n-Unterstützung
- Jedes Feld hat `label` und `description` in allen Sprachen
- Prompt-Instruktionen mehrsprachig
- Validierungs-Fehlermeldungen mehrsprachig

### 2. Validierung pro Feld
- `validation.pattern` für Regex
- `validation.min`/`max` für Zahlen
- `validation.minLength`/`maxLength` für Strings
- `validation.message` für custom Fehlermeldungen

### 3. Normalisierung
- `normalization.trim` - Whitespace entfernen
- `normalization.lowercase` - Kleinschreibung
- `normalization.uppercase` - Großschreibung
- Weitere können hinzugefügt werden

### 4. AI-Steuerung
- `ai_fillable` - Kann AI dieses Feld füllen?
- `ask_user` - Nutzer fragen?
- `prompt` - Instruktionen für AI

### 5. Type Discrimination
- `discriminator: "@type"` - Welches Feld bestimmt den Typ?
- `variants` - Liste der möglichen Typen
- Jede Variante hat eigene Felder

## Migration

### Schritt 1: Migrations-Skript erweitern

```javascript
function migrateNestedFields(items) {
  if (!items?.shape?.oneOf) return items;
  
  return {
    datatype: 'object',
    discriminator: '@type',
    variants: items.shape.oneOf.map(variant => ({
      '@type': variant['@type'],
      label: { de: variant['@type'], en: variant['@type'] }, // Placeholder
      fields: Object.keys(variant)
        .filter(key => key !== '@type')
        .map(key => ({
          id: key,
          label: { de: key, en: key }, // Placeholder
          datatype: variant[key],
          ai_fillable: true
        }))
    }))
  };
}
```

### Schritt 2: Manuelle Verfeinerung

Nach Migration manuell:
1. Labels übersetzen
2. Descriptions hinzufügen
3. Prompts hinzufügen
4. Validierungen definieren
5. Normalisierungen festlegen

## Services-Anpassungen

### SchemaLocalizerService

Muss erweitert werden für:
```typescript
localizeNestedField(variants: any[], language: string) {
  return variants.map(variant => ({
    ...variant,
    label: this.localizeString(variant.label, language),
    description: this.localizeString(variant.description, language),
    fields: variant.fields.map(field => this.localizeField(field, language))
  }));
}
```

### FieldExtractionWorkerPoolService

Prompt-Building für verschachtelte Felder:
```typescript
if (field.system.items?.variants) {
  prompt += `\nMögliche Typen:\n`;
  field.system.items.variants.forEach(variant => {
    prompt += `- ${variant['@type']}: ${variant.description[language]}\n`;
    prompt += `  Felder: ${variant.fields.map(f => f.label[language]).join(', ')}\n`;
  });
}
```

### FieldNormalizerService

Validierung und Normalisierung für jedes Feld in Varianten.

## Status & Implementierung

### ✅ Implementiert

1. **i18n-Struktur** - Alle verschachtelten Felder unterstützen DE/EN
2. **Shape Expansion** - `ShapeExpanderService` erstellt automatisch Sub-Fields
3. **UI-Darstellung** - Baum-Hierarchie mit visuellen Tree-Lines (├─, └─)
4. **Lokalisierung** - `SchemaLocalizerService` lokalisiert Sub-Fields
5. **JSON-Export** - Rekonstruktion von Objekten aus Sub-Fields

### Verwendete Schemas

**Vollständig implementiert:**
- ✅ `event.json` - `schema:location` (Place, VirtualLocation, PostalAddress)
- ✅ `education_offer.json` - `schema:location`
- ✅ `organization.json` - `schema:address`, `schema:legalAddress`
- ✅ `person.json` - `schema:address`

### Siehe auch

- **[SCHEMA_I18N.md](./SCHEMA_I18N.md)** - Vollständige Schema-i18n-Dokumentation
- **Beispiel:** `src/schemata/event.json` - Verschachtelte Felder mit i18n
- **Service:** `src/app/services/shape-expander.service.ts` - Sub-Field Expansion
- **Service:** `src/app/services/schema-localizer.service.ts` - Lokalisierung
