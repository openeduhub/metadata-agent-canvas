# JSON Viewer/Editor Modus

## Übersicht

Die Webkomponente unterstützt jetzt einen **JSON Viewer/Editor Modus**, der es ermöglicht, bereits erzeugte Metadaten-JSON zu importieren, zu bearbeiten und inkrementell zu aktualisieren.

## Features

### 📂 JSON-Import
- **Lade-Symbol** im Header (neben Language Switcher)
- Unterstützt alle generierten Metadaten-JSON-Dateien
- Automatische Schema-Erkennung

### 🔍 Automatische Schema-Detection

Das System erkennt automatisch das verwendete Schema:

1. **Explizite Metadataset-Property**
   - `metadataset: "mds_oeh_event"` → Event-Schema
   - `metadataset: "mds_oeh_tool"` → Tool-Schema
   - `ccm:metadataset` Property

2. **Heuristische Erkennung**
   - Event: `ccm:oeh_event_date_from`, `ccm:oeh_event_date_to`, `ccm:oeh_event_location`
   - Tool: `ccm:oeh_tool_category`, `ccm:oeh_tool_features`

3. **Fallback**
   - Standard OEH-Schema (`mds_oeh`)

### ⚙️ Feld-Mapping

Das System mappt JSON-Werte intelligent auf Felder:

```typescript
// Direkte Property-Match
jsonData["ccm:title"] → field.value

// Namespace-Varianten
jsonData["ccm:title"] → field "ccm:title"
jsonData["title"] → field "ccm:title"

// Unterstützte Namespaces:
// - ccm:
// - cclom:
// - cm:
```

### 🔄 Inkrementelle Updates

Bei neuen Eingaben wird der **aktuelle Metadaten-Stand** an den LLM gesendet:

```
Neue Eingabe: "Der Workshop findet am 15.03.2025 statt"

+ Aktueller Metadaten-Stand:
  Titel: Photosynthese Workshop
  Autor: Dr. Schmidt
  Sprache: Deutsch
  ...
```

Der LLM kann dann:
- Bestehende Felder aktualisieren
- Neue Felder ergänzen
- Widersprüche auflösen

## Verwendung

### 1. JSON-Datei laden

```typescript
// Klick auf 📂 Symbol im Header
// → Dateiauswahl-Dialog
// → Automatische Schema-Detection
// → Felder werden vorausgefüllt
```

### 2. Metadaten bearbeiten

```typescript
// Manuelle Änderungen in Feldern
// ODER
// Neue Beschreibung eingeben + "Extraktion starten"
// → LLM aktualisiert Felder basierend auf aktuellem Stand
```

### 3. Export

```typescript
// Bookmarklet/Standalone: "JSON herunterladen"
// Browser-Extension: An Plugin senden
```

## API

### CanvasService

```typescript
/**
 * Import JSON und vorausfüllen
 */
async importJsonData(
  jsonData: any,
  detectedSchema?: string
): Promise<void>

/**
 * Export aktuellen Stand
 */
exportAsJson(): any

/**
 * Get Metadaten-Kontext für LLM
 */
getCurrentMetadataContext(): string
```

### JsonLoaderComponent

```typescript
@Output() jsonLoaded = new EventEmitter<LoadedJsonData>();

interface LoadedJsonData {
  metadata: any;
  detectedSchema?: string;
  fileName: string;
}
```

## Workflow-Beispiele

### Beispiel 1: JSON-Review & Korrektur

```
1. JSON laden (z.B. metadata_1234567890.json)
2. Felder werden automatisch gefüllt
3. Manuelle Korrekturen vornehmen
4. Neue JSON exportieren
```

### Beispiel 2: Inkrementelle Erweiterung

```
1. Basis-Metadaten aus JSON laden
   → Titel, Autor, Sprache gefüllt

2. Neue Info eingeben: "Der Workshop kostet 50€"
   → LLM erkennt Preis-Information
   → Fügt ccm:price hinzu
   → Behält andere Felder bei

3. Weitere Info: "Anmeldung bis 01.03.2025"
   → LLM fügt Anmeldefrist hinzu
   → Alle bisherigen Daten bleiben erhalten
```

### Beispiel 3: Event-Metadaten vervollständigen

```
1. Event-JSON laden (erkannt durch Schema-Detection)
   → Event-spezifische Felder werden geladen
   → Basis-Informationen gefüllt

2. Location-Info ergänzen: "Berlin, Alexanderplatz"
   → Geocoding läuft automatisch
   → Koordinaten werden ergänzt

3. Datum korrigieren über neue Eingabe
   → LLM aktualisiert nur Datum-Felder
   → Rest bleibt unverändert
```

## UI-Elemente

### Header (Browser Extension / Bookmarklet)

```
[Browser-Erweiterung] [👥 Gast] | [📂] [🇩🇪 DE ▾] [×]
                                  ↑
                            JSON-Loader
```

### Erfolgs-Dialog nach Import

```
✅ JSON erfolgreich geladen!

metadata_event_123.json
Schema: mds_oeh_event

[OK]
```

### Error-Toast

```
⚠️ Ungültige JSON-Datei: Unexpected token...
```

## Technische Details

### Schema-Detection-Logik

```typescript
private detectSchema(jsonData: any): string | undefined {
  // 1. Explizite Property
  if (jsonData.metadataset) return jsonData.metadataset;
  if (jsonData['ccm:metadataset']) return jsonData['ccm:metadataset'];
  
  // 2. Heuristik: Event
  if (jsonData['ccm:oeh_event_date_from']) return 'mds_oeh_event';
  
  // 3. Heuristik: Tool
  if (jsonData['ccm:oeh_tool_category']) return 'mds_oeh_tool';
  
  // 4. Fallback
  return 'mds_oeh';
}
```

### Value-Mapping

```typescript
private findValueInJson(jsonData: any, fieldId: string): any {
  // 1. Direkt
  if (jsonData[fieldId]) return jsonData[fieldId];
  
  // 2. Mit Namespace
  for (const prefix of ['ccm:', 'cclom:', 'cm:']) {
    if (jsonData[prefix + fieldId]) return jsonData[prefix + fieldId];
  }
  
  // 3. Ohne Namespace
  const withoutNs = fieldId.replace(/^(ccm:|cclom:|cm:)/, '');
  if (jsonData[withoutNs]) return jsonData[withoutNs];
  
  return undefined;
}
```

### Metadaten-Kontext für LLM

```typescript
getCurrentMetadataContext(): string {
  const filledFields = allFields
    .filter(f => f.value !== undefined && f.value !== '')
    .map(f => `${f.label}: ${f.value}`);
  
  if (filledFields.length === 0) return '';
  
  return `\n\nAktueller Metadaten-Stand:\n${filledFields.join('\n')}`;
}
```

## Zukünftige Erweiterungen

### Read-Only-Modus (geplant)
- Toggle-Button zum Sperren aller Felder
- Reine Ansicht ohne Bearbeitungsmöglichkeit
- Nützlich für Review-Workflows

### Version-Tracking (geplant)
- Historie der Änderungen
- Vergleich zwischen Versionen
- Rollback-Funktion

### Batch-Import (geplant)
- Mehrere JSON-Dateien gleichzeitig
- Merge-Strategien
- Conflict-Resolution

## Troubleshooting

### Problem: Schema wird nicht erkannt

**Lösung:** JSON-Datei muss eines der folgenden enthalten:
- `metadataset` Property
- Event-spezifische Felder
- Tool-spezifische Felder

### Problem: Felder werden nicht gefüllt

**Ursache:** Field-ID-Mismatch

**Lösung:** Überprüfe Namespace-Präfixe in der JSON:
- `ccm:title` ✅
- `title` ✅ (wird gemappt)
- `lom:title` ❌ (nicht unterstützt)

### Problem: Werte werden überschrieben

**Verhalten:** Beim Import werden alle Felder mit JSON-Werten überschrieben

**Workaround:** 
1. Manuelle Änderungen vor Import machen
2. Oder: JSON manuell bearbeiten vor Import

## Best Practices

1. **Schema-Konsistenz:** Verwende immer `metadataset` Property in exportierten JSONs
2. **Namespace-Verwendung:** Nutze vollständige Field-IDs mit Namespace
3. **Inkrementelle Updates:** Kleine, fokussierte Eingaben für präzise Updates
4. **Export-Häufigkeit:** Regelmäßig exportieren als Backup
5. **Versionierung:** Dateinamen mit Timestamps für Nachvollziehbarkeit

## Siehe auch

- [Canvas Service API](../src/app/services/canvas.service.ts)
- [JSON Loader Component](../src/app/components/json-loader/)
- [Schema Loader Service](../src/app/services/schema-loader.service.ts)
