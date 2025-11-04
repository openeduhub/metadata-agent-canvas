# JSON Export/Import Format

Die Webkomponente-Canvas unterstützt ein strukturiertes JSON-Format für den Export und Import von Metadaten.

## Neue Strukturierte Format (aktuell)

Jedes Metadatenfeld enthält den Wert und alle Schema-Informationen in einem Objekt:

```json
{
  "metadataset": "mds_oeh",
  "exportedAt": "2025-02-04T08:30:00.000Z",
  "language": "de",
  
  "cclom:title": {
    "value": "Einführung in die Photosynthese",
    "repoField": true,
    "datatype": "string",
    "multiple": false,
    "required": true,
    "schema": "core",
    "uri": "http://w3id.org/openeduhub/vocabs/cclom/title",
    "label": "Titel",
    "description": "Der Titel der Lernressource",
    "status": "filled",
    "hasVocabulary": false,
    "confidence": 0.95
  },
  
  "cclom:general_keyword": {
    "value": [
      "http://w3id.org/openeduhub/vocabs/oeh-topics/38e90eeb-9404-4337-90a0-d6e8b2e2b2f3",
      "http://w3id.org/openeduhub/vocabs/oeh-topics/f3e90eeb-9404-4337-90a0-d6e8b2e2b2a8"
    ],
    "displayValue": ["Biologie", "Pflanzen"],
    "repoField": true,
    "datatype": "string",
    "multiple": true,
    "required": false,
    "schema": "core",
    "uri": "http://w3id.org/openeduhub/vocabs/cclom/general_keyword",
    "label": "Schlagworte",
    "status": "filled",
    "hasVocabulary": true,
    "vocabularyType": "closed",
    "confidence": 0.88
  },
  
  "ccm:oeh_flex_lrt": {
    "value": "http://w3id.org/openeduhub/vocabs/new_lrt/a4dd48da-80ec-4c17-b0e8-7bbf0ec1e7e7",
    "displayValue": "Unterrichtsplanung",
    "repoField": true,
    "datatype": "string",
    "multiple": false,
    "required": false,
    "schema": "core",
    "uri": "http://w3id.org/openeduhub/vocabs/ccm/oeh_flex_lrt",
    "label": "Inhaltstyp",
    "status": "filled",
    "hasVocabulary": true,
    "vocabularyType": "closed"
  },
  
  "schema:location": {
    "value": [
      {
        "@type": "Place",
        "name": "Berlin",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Berlin",
          "addressCountry": "DE"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": 52.52,
          "longitude": 13.405
        }
      }
    ],
    "repoField": false,
    "datatype": "object",
    "multiple": true,
    "required": false,
    "schema": "event",
    "uri": "http://schema.org/location",
    "label": "Veranstaltungsort",
    "status": "filled",
    "hasVocabulary": false
  }
}
```

## Vorteile des neuen Formats

1. **Selbstbeschreibend**: Jedes Feld enthält alle notwendigen Metadaten
2. **Typsicher**: `datatype`, `multiple`, `required` sind direkt verfügbar
3. **Schema-Aware**: Zeigt zu welchem Schema ein Feld gehört
4. **Display-Werte**: Bei Vokabularen werden URIs und Labels beide gespeichert
5. **Übersichtlich**: Alles zu einem Feld an einer Stelle
6. **Versionierbar**: `exportedAt` und `language` für Nachverfolgbarkeit
7. **Confidence**: AI-Extraktions-Confidence wird mitgespeichert

## Altes Format (noch unterstützt)

Für Abwärtskompatibilität wird das alte flache Format weiterhin beim Import unterstützt:

```json
{
  "metadataset": "mds_oeh",
  
  "cclom:title": "Einführung in die Photosynthese",
  "cclom:title_repo_field": true,
  
  "cclom:general_keyword": [
    "http://w3id.org/openeduhub/vocabs/oeh-topics/38e90eeb-9404-4337-90a0-d6e8b2e2b2f3"
  ],
  "cclom:general_keyword_repo_field": true,
  "cclom:general_keyword_display": ["Biologie"]
}
```

Das System erkennt automatisch das Format beim Import und konvertiert es intern.

## Feld-Metadaten

Jedes Feld-Objekt kann folgende Properties enthalten:

| Property | Typ | Beschreibung |
|----------|-----|--------------|
| `value` | any | Der eigentliche Wert (String, Array, Object) |
| `displayValue` | string/array | Lesbare Labels bei URI-basierten Vokabularen |
| `repoField` | boolean | Ob das Feld ins Repository übernommen wird |
| `datatype` | string | Datentyp: string, number, boolean, date, url, object |
| `multiple` | boolean | Ob Mehrfachauswahl erlaubt ist |
| `required` | boolean | Ob das Feld ein Pflichtfeld ist |
| `schema` | string | Schema-Zugehörigkeit (core, event, tool, etc.) |
| `uri` | string | Eindeutiger URI des Feldes |
| `label` | string | Anzeigelabel in aktueller Sprache |
| `description` | string | Beschreibung des Feldes |
| `status` | string | Status: empty, extracting, filled, error |
| `hasVocabulary` | boolean | Ob das Feld ein kontrolliertes Vokabular hat |
| `vocabularyType` | string | Art des Vokabulars: closed, open |
| `confidence` | number | AI-Extraktions-Confidence (0-1) |

## Komplexe Objekte (Shape-basierte Felder)

Felder mit Sub-Struktur (z.B. `schema:location`) werden als komplette Objekte gespeichert:

```json
{
  "schema:location": {
    "value": {
      "@type": "Place",
      "name": "Berlin",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Berlin",
        "addressCountry": "DE"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 52.52,
        "longitude": 13.405
      }
    },
    "repoField": false,
    "datatype": "object",
    "schema": "event",
    "label": "Veranstaltungsort"
  }
}
```

Sub-Felder werden automatisch rekonstruiert beim Export.

## Repository-Format (getMetadataForPlugin)

Für die Browser-Extension wird ein separates Format verwendet, das kompatibel mit der Repository-API ist:

```json
{
  "cclom:title": "Einführung in die Photosynthese",
  "cclom:general_keyword": [
    "http://w3id.org/openeduhub/vocabs/oeh-topics/38e90eeb-9404-4337-90a0-d6e8b2e2b2f3"
  ]
}
```

Dieses Format:
- Enthält nur die Werte (ohne Metadaten)
- Konvertiert `{label, uri}` zu reinen URI-Strings
- Ist optimiert für Repository-API Calls
- Wird automatisch in `getMetadataForPlugin()` generiert

## Import-Verhalten

Die `importJsonData()` Methode:
1. Erkennt automatisch das Format (alt vs. neu)
2. Konvertiert altes Format zu neuem Format
3. Lädt das passende Schema (core, event, tool)
4. Füllt alle Felder mit den importierten Werten
5. Rekonstruiert komplexe Objekte mit Sub-Feldern
6. Behält Vokabular-URIs und Display-Werte

## Beispiel-Verwendung

**Export:**
```typescript
const jsonData = this.canvasService.exportAsJson();
const jsonString = JSON.stringify(jsonData, null, 2);
// Speichern oder Download
```

**Import:**
```typescript
const jsonData = JSON.parse(fileContent);
await this.canvasService.importJsonData(jsonData);
// Alle Felder sind jetzt gefüllt
```

## Migration von alten Dateien

Alte JSON-Dateien funktionieren weiterhin ohne Änderung. Beim Import werden sie automatisch konvertiert. Nach einem Re-Export erhalten sie das neue strukturierte Format.
