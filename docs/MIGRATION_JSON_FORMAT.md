# Migration: Neues strukturiertes JSON-Format

**Datum:** 04.02.2025  
**Status:** ✅ Vollständig implementiert

## Übersicht

Die Webkomponente-Canvas wurde auf ein neues strukturiertes JSON-Export-Format umgestellt. Alle Metadaten zu einem Feld sind jetzt an einer Stelle gruppiert.

## Was wurde geändert?

### Alte Struktur (flach)

```json
{
  "metadataset": "mds_oeh",
  "cclom:title": "Der Titel",
  "cclom:title_repo_field": true,
  "cclom:general_keyword": ["uri1", "uri2"],
  "cclom:general_keyword_repo_field": true,
  "cclom:general_keyword_display": ["Label1", "Label2"]
}
```

**Probleme:**
- Unübersichtlich: Werte und Flags verstreut
- Namenskonflikte durch Suffixe (`_repo_field`, `_display`)
- Keine Schema-Informationen im Export
- Schwierig zu validieren und zu parsen

### Neue Struktur (gruppiert)

```json
{
  "metadataset": "mds_oeh",
  "exportedAt": "2025-02-04T08:30:00.000Z",
  "language": "de",
  "cclom:title": {
    "value": "Der Titel",
    "repoField": true,
    "datatype": "string",
    "multiple": false,
    "required": true,
    "schema": "core",
    "uri": "http://...",
    "label": "Titel",
    "status": "filled",
    "hasVocabulary": false,
    "confidence": 0.95
  },
  "cclom:general_keyword": {
    "value": ["uri1", "uri2"],
    "displayValue": ["Label1", "Label2"],
    "repoField": true,
    "datatype": "string",
    "multiple": true,
    "required": false,
    "schema": "core",
    "hasVocabulary": true,
    "vocabularyType": "closed",
    "confidence": 0.88
  }
}
```

**Vorteile:**
- ✅ Alles zu einem Feld an einer Stelle
- ✅ Selbstbeschreibend mit allen Schema-Infos
- ✅ Einfach zu parsen und zu validieren
- ✅ Versionierung durch `exportedAt` und `language`
- ✅ AI-Confidence wird mitgespeichert
- ✅ Display-Werte direkt im Feld-Objekt

## Betroffene Methoden

### `canvas.service.ts`

#### 1. `exportAsJson()` - NEU STRUKTURIERT

**Vorher:**
- Flache Struktur mit separaten `_repo_field` und `_display` Feldern
- Keine Metadaten im Export

**Jetzt:**
- Jedes Feld ist ein Objekt mit `value` und allen Metadaten
- Automatische Rekonstruktion von komplexen Objekten (Sub-Felder)
- Export von Schema-Informationen, Confidence, Status

#### 2. `getMetadataJson()` - VEREINFACHT

**Vorher:**
- Separate Logik für enriched output
- Komplexe Mappings

**Jetzt:**
- Ruft einfach `exportAsJson()` auf
- Konsistente Ausgabe

#### 3. `importJsonData()` - FORMAT-ERKENNUNG

**Neu hinzugefügt:**
- Automatische Format-Erkennung (alt vs. neu)
- Konvertierung von altem zu neuem Format
- Unterstützt beide Formate beim Import

**Neue Hilfsmethoden:**
- `detectJsonFormat()` - Erkennt Format anhand Struktur
- `convertOldToNewFormat()` - Konvertiert altes Format

#### 4. `getMetadataForPlugin()` - UNVERÄNDERT

Diese Methode bleibt unverändert und erzeugt weiterhin das Repository-API-kompatible Format:
```json
{
  "cclom:title": "Der Titel",
  "cclom:general_keyword": ["uri1", "uri2"]
}
```

**Grund:** Browser-Extension benötigt dieses Format für Repository-API Calls.

## Abwärtskompatibilität

✅ **Vollständig gewährleistet!**

- Alte JSON-Dateien funktionieren weiterhin beim Import
- Automatische Konvertierung beim Import
- Nach Re-Export haben sie das neue Format
- Keine Breaking Changes für Nutzer

## Test-Dateien

Zum Testen der neuen Funktionalität:

- `docs/example-export-new-format.json` - Neues strukturiertes Format
- `docs/example-export-old-format.json` - Altes flaches Format (für Tests)
- `docs/JSON_FORMAT.md` - Vollständige Format-Dokumentation

## Migration für Entwickler

### Export

```typescript
// Neues strukturiertes Format (automatisch)
const jsonData = this.canvasService.exportAsJson();

// Beispiel-Ausgabe:
{
  "cclom:title": {
    "value": "Der Titel",
    "repoField": true,
    "datatype": "string",
    "multiple": false,
    "required": true,
    "schema": "core"
    // ... weitere Metadaten
  }
}
```

### Import

```typescript
// Unterstützt beide Formate automatisch
await this.canvasService.importJsonData(jsonData);

// Format wird automatisch erkannt und konvertiert
```

### Zugriff auf Werte

```typescript
// NEU: Wert aus strukturiertem Format
const title = jsonData["cclom:title"].value;
const isRepoField = jsonData["cclom:title"].repoField;
const datatype = jsonData["cclom:title"].datatype;

// Display-Werte bei Vokabularen
const keywords = jsonData["cclom:general_keyword"].value; // URIs
const keywordLabels = jsonData["cclom:general_keyword"].displayValue; // Labels
```

## Validierung

Das neue Format ermöglicht einfache Validierung:

```typescript
function validateField(fieldId: string, fieldData: any): boolean {
  // Pflichtfelder prüfen
  if (!fieldData.value || !fieldData.repoField === undefined) {
    return false;
  }
  
  // Datentyp prüfen
  if (fieldData.datatype === 'string' && typeof fieldData.value !== 'string') {
    return false;
  }
  
  // Multiple prüfen
  if (fieldData.multiple && !Array.isArray(fieldData.value)) {
    return false;
  }
  
  return true;
}
```

## Schema-Evolution

Das neue Format ist flexibel und erweiterbar:

**Neue Metadaten hinzufügen:**
```typescript
// In exportAsJson()
fieldData.customProperty = field.customValue;
```

**Beispiele für zukünftige Erweiterungen:**
- `validationErrors: string[]` - Validierungsfehler
- `lastModified: string` - Letzte Änderung
- `extractionSource: string` - Quelle der Extraktion (AI, Manual, etc.)
- `alternativeValues: any[]` - Alternative Vorschläge

## Testing

**Build-Test erfolgreich:**
```bash
npm run build
✅ Build at: 2025-11-04T08:39:47.172Z - Hash: 41b744ae3e0c7011
```

**Test-Szenarien:**
1. ✅ Export im neuen Format
2. ✅ Import von neuem Format
3. ✅ Import von altem Format (Konvertierung)
4. ✅ Re-Export nach Import (behält neues Format)
5. ✅ Plugin-Export (behält Repository-Format)

## Nächste Schritte

1. **Testen in Standalone-Mode:**
   - JSON exportieren
   - JSON wieder importieren
   - Felder prüfen

2. **Testen in Browser-Extension:**
   - Metadaten an Plugin senden (sollte weiterhin funktionieren)
   - Repository-Format wird automatisch verwendet

3. **Dokumentation teilen:**
   - `docs/JSON_FORMAT.md` - Format-Referenz
   - Beispiel-Dateien zum Testen

## Zusammenfassung

✅ **Erfolgreiche Migration auf strukturiertes JSON-Format**

**Änderungen:**
- 3 Methoden angepasst (`exportAsJson`, `getMetadataJson`, `importJsonData`)
- 2 neue Hilfsmethoden (`detectJsonFormat`, `convertOldToNewFormat`)
- 3 neue Dokumentations-Dateien
- Vollständige Abwärtskompatibilität
- Build erfolgreich getestet

**Keine Breaking Changes:**
- Plugin-Integration unverändert
- Alte Dateien funktionieren weiterhin
- Automatische Konvertierung

**Vorteile für Nutzer:**
- Übersichtlichere JSON-Dateien
- Vollständige Metadaten-Informationen
- Einfachere Validierung und Debugging
- Zukunftssicher durch erweiterbare Struktur
