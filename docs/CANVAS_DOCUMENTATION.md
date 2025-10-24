# Canvas-Version: Metadaten-Extraktion mit paralleler Verarbeitung

## 🎯 Überblick

Die Canvas-Version ist eine alternative Implementierung der Metadaten-Extraktion mit folgenden Hauptmerkmalen:

- **Parallele Feld-Extraktion**: Bis zu 10 Felder werden gleichzeitig extrahiert
- **Canvas-basierte UI**: Alle Felder auf einmal sichtbar, direkte Inline-Bearbeitung
- **Streaming-Updates**: Felder füllen sich live während der Extraktion
- **Keine Chat-Interaktion**: Linearer Workflow ohne Bestätigungsschritte

## 🏗️ Architektur

### Komponenten-Struktur

```
webkomponente-canvas/
├── src/app/
│   ├── models/
│   │   └── canvas-models.ts          # Canvas-spezifische Datenmodelle
│   ├── services/
│   │   ├── canvas.service.ts         # Hauptservice für State-Management
│   │   ├── field-extraction-worker-pool.service.ts  # Parallele Extraktion
│   │   └── schema-loader.service.ts  # Schema-Verwaltung (geerbt)
│   └── components/
│       ├── canvas-view/              # Haupt-Canvas-Komponente
│       │   ├── canvas-view.component.ts
│       │   ├── canvas-view.component.html
│       │   └── canvas-view.component.scss
│       └── canvas-field/             # Einzelfeld-Komponente
│           ├── canvas-field.component.ts
│           ├── canvas-field.component.html
│           └── canvas-field.component.scss
```

### Datenfluss

```
User Input
    ↓
[Canvas Service] → Content Type Detection (Background)
    ↓
[Worker Pool] → Parallel Field Extraction
    ↓        ↓        ↓        ↓
   Field1  Field2  Field3  ... Field10
    ↓
[Canvas State] → Live UI Updates
    ↓
[Canvas View] → User sees streaming results
```

## 🔧 Technische Details

### Worker Pool Service

**Datei**: `field-extraction-worker-pool.service.ts`

- **Max Workers**: 10 (konfigurierbar)
- **Queue-Management**: Priorisierung nach Pflichtfeldern
- **LLM-Model**: `gpt-4o-mini` (schnell und kostengünstig)

```typescript
// Worker-Pool nutzen
await this.workerPool.extractField({
  field: fieldState,
  userText: userInput,
  priority: field.isRequired ? 10 : 5
});
```

### Canvas Service

**Datei**: `canvas.service.ts`

**Hauptmethoden**:

- `startExtraction(userText)`: Startet den Extraktionsprozess
- `updateFieldValue(fieldId, value)`: Manuelle Feldänderung
- `getMetadataJson()`: Exportiert finales JSON

**State-Management**:
- RxJS BehaviorSubject für reaktive Updates
- Observable-Pattern für UI-Synchronisation

### Canvas State Model

```typescript
interface CanvasState {
  userText: string;
  detectedContentType: string | null;
  contentTypeConfidence: number;
  selectedContentType: string | null;
  coreFields: CanvasFieldState[];
  specialFields: CanvasFieldState[];
  fieldGroups: FieldGroup[];
  isExtracting: boolean;
  extractionProgress: number;
  totalFields: number;
  filledFields: number;
  metadata: Record<string, any>;
}
```

### Field Status

```typescript
enum FieldStatus {
  EMPTY = 'empty',       // ⚪ Noch nicht gefüllt
  EXTRACTING = 'extracting', // ⏳ Wird gerade extrahiert
  FILLED = 'filled',     // ✅ Erfolgreich gefüllt
  ERROR = 'error'        // ❌ Fehler bei Extraktion
}
```

## 🎨 UI-Features

### Feld-Darstellung

Jedes Feld zeigt:

1. **Status-Icon**: Visuelles Feedback (⚪⏳✅❌)
2. **Label**: Feldbezeichnung mit Pflicht-Marker (*)
3. **Input-Feld**: 
   - Autocomplete für Vokabulare
   - Chips für Array-Felder
   - Validation Patterns
4. **Info-Button**: Tooltip mit Beschreibung
5. **Confidence-Badge**: KI-Konfidenz (wenn gefüllt)

### Gruppen-Organisation

Felder sind nach Schema-Gruppen organisiert:

- **Inhaltsart-Auswahl** (speziell hervorgehoben)
- **Basis**
- **Beschreibung**
- **Publikation**
- **Lizenz**
- **Klassifikation**
- **Zielgruppe**
- **Bildungskontext**

### Spezielle Features

#### Autocomplete für Vokabulare

Felder mit geschlossenen Vokabularen zeigen Autocomplete:

```typescript
// Beispiel: Bildungsstufe
vocabulary: {
  type: 'skos',
  concepts: [
    { label: 'Hochschule', uri: '...' },
    { label: 'Schule', uri: '...' }
  ]
}
```

#### Chips für Arrays

Array-Felder (z.B. Keywords) zeigen Chips:

```html
<div class="chip-container">
  <span class="chip">KI <button>×</button></span>
  <span class="chip">Didaktik <button>×</button></span>
</div>
```

## 🚀 Workflow

### 1. Initialisierung

```typescript
await canvasService.startExtraction(userText);
```

**Ablauf**:
1. Core-Schema laden
2. Felder initialisieren
3. UI rendern (alle Felder leer)

### 2. Parallel Extraction

**Background**:
- Content-Type-Erkennung läuft parallel
- 10 Worker extrahieren Core-Felder gleichzeitig

**UI-Updates**:
- Felder wechseln zu `EXTRACTING` (⏳)
- Nach Extraktion zu `FILLED` (✅)
- Progress-Bar aktualisiert sich

### 3. Special Schema Loading

Sobald Content-Type erkannt:
1. Spezial-Schema nachladen
2. Neue Felder zur UI hinzufügen
3. Parallel-Extraktion für Spezial-Felder starten

### 4. User Interaction

**Während Extraktion**:
- User kann bereits gefüllte Felder bearbeiten
- Autocomplete hilft bei Vokabular-Feldern
- Chips können entfernt/hinzugefügt werden

**Content-Type-Änderung**:
```typescript
// Triggert automatisch:
// 1. Spezial-Felder löschen
// 2. Neues Schema laden
// 3. Neu-Extraktion starten
```

### 5. Finalisierung

**Pflichtfeld-Check**:
```typescript
allRequiredFieldsFilled(): boolean {
  const required = fields.filter(f => f.isRequired);
  return required.every(f => f.status === FieldStatus.FILLED);
}
```

**JSON-Export**:
```typescript
confirmAndExport(): void {
  if (!this.allRequiredFieldsFilled()) {
    alert('Pflichtfelder ausfüllen!');
    return;
  }
  this.downloadJson();
}
```

## ⚙️ Konfiguration

### Worker-Pool-Größe ändern

```typescript
// In field-extraction-worker-pool.service.ts
private maxWorkers = 10; // <- Hier anpassen

// Oder dynamisch:
workerPool.setMaxWorkers(15);
```

### LLM-Model ändern

```typescript
// In canvas.service.ts und worker-pool.service.ts
this.llm = new ChatOpenAI({
  model: 'gpt-4o-mini', // <- Hier anpassen
  temperature: 0.3,
  apiKey: apiKey
});
```

## 🔍 Debugging

### State beobachten

```typescript
canvasService.state$.subscribe(state => {
  console.log('Canvas State:', state);
  console.log('Progress:', state.extractionProgress);
  console.log('Filled:', state.filledFields, '/', state.totalFields);
});
```

### Worker-Pool-Status

```typescript
const status = workerPool.getStatus();
console.log('Active Workers:', status.activeWorkers);
console.log('Queue Length:', status.queueLength);
```

## 🎯 Performance

### Erwartete Zeiten

| Anzahl Felder | Sequenziell | Parallel (10 Worker) |
|---------------|-------------|----------------------|
| 10 Felder     | ~10s        | ~2s                  |
| 20 Felder     | ~20s        | ~4s                  |
| 30 Felder     | ~30s        | ~6s                  |

**Faktoren**:
- LLM-API-Latenz: ~500-1000ms pro Feld
- Parallel-Faktor: ~5x schneller
- Streaming-UI: User sieht sofort Ergebnisse

## 🐛 Bekannte Einschränkungen

1. **Browser-Limits**: Mehr als 10 parallele API-Calls können zu Rate-Limiting führen
2. **Memory**: Große Schemas (>50 Felder) können Performance-Probleme verursachen
3. **Autocomplete**: Bei sehr großen Vokabularen (>100 Einträge) langsam

## 🔮 Zukünftige Erweiterungen

- [ ] Caching von Extraktionsergebnissen
- [ ] Offline-Modus mit lokalem Storage
- [ ] Export-Formate (RDF, XML, etc.)
- [ ] Batch-Processing für mehrere Ressourcen
- [ ] Undo/Redo-Funktionalität
- [ ] Collaborative Editing (Multi-User)

## 📚 Vergleich: Chat vs. Canvas

| Feature | Chat-Version | Canvas-Version |
|---------|--------------|----------------|
| **UI-Paradigma** | Konversationell | Formular-basiert |
| **Extraktion** | Sequenziell | Parallel |
| **Bestätigungen** | Mehrere Schritte | Einmal am Ende |
| **Feldsicht** | Schrittweise | Alle auf einmal |
| **Bearbeitung** | Chat-Befehle | Inline-Editing |
| **Performance** | ~30s für 20 Felder | ~6s für 20 Felder |
| **UX** | Geführt | Selbstbestimmt |

## 🔗 Ressourcen

- **Core-Schema**: `src/schemata/core.json`
- **Spezial-Schemas**: `src/schemata/*.json`
- **Environment**: `.env` (OPENAI_API_KEY)
- **Dokumentation**: `README.md`, `PERFORMANCE.md`
