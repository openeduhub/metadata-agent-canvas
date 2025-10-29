# Internationalization (i18n) - App UI

**Status:** ✅ Vollständig implementiert (Januar 2025)

## Übersicht

Die Canvas-App unterstützt **vollständige Mehrsprachigkeit** mit Deutsch (DE) und Englisch (EN). Alle UI-Elemente, Meldungen und KI-Prompts sind lokalisiert.

---

## Features

### ✅ Sprachunterstützung

- **Deutsch (DE)** - Standardsprache
- **Englisch (EN)** - Alternative Sprache
- **Automatische Browser-Erkennung** beim ersten Start
- **Persistierung** in localStorage (`app_language`)
- **Language Switcher** im Header (Flaggen-UI)

### ✅ Lokalisierte Bereiche

| Bereich | Status | Beschreibung |
|---------|--------|--------------|
| **Header** | ✅ | Mode-Badges, Buttons |
| **Input Section** | ✅ | Placeholder, Buttons, Labels |
| **Content Type Dropdown** | ✅ | Optionen & Labels |
| **Progress Bar** | ✅ | Status-Texte |
| **Field Components** | ✅ | Buttons, Tooltips, Status |
| **Empty State** | ✅ | Meldungen |
| **Footer** | ✅ | Submit-Buttons, Info-Texte |
| **Alerts & Dialogs** | ✅ | Success, Error, Confirmation |
| **AI Prompts** | ✅ | Extraktion, Normalisierung |
| **Schema-Daten** | ✅ | Labels, Vokabulare, Beschreibungen |

---

## Language Switcher

### UI-Position

**Standalone Mode:**
```
┌──────────────────────────────────┐
│  Metadata Agent  🇩🇪 DE ▼     │  ← Rechts oben
└──────────────────────────────────┘
```

**Browser Extension / Bookmarklet Mode:**
```
┌──────────────────────────────────┐
│  🔌 Browser Extension  👤 Gast   │
│                     🇩🇪 DE ▼    │  ← Rechts oben
└──────────────────────────────────┘
```

### Funktionsweise

**Dropdown-Optionen:**
```
🇩🇪 Deutsch    ← Aktive Sprache (mit ✓)
🇬🇧 English
```

**Click:**
```
User klickt "English"
  ↓
I18nService.setLanguage('en')
  ↓
localStorage.setItem('app_language', 'en')
  ↓
Observable: currentLanguage$ emits 'en'
  ↓
Alle Komponenten reagieren automatisch
  ↓
UI zeigt englische Texte ✅
```

---

## Translation Files

### Struktur

**Dateien:**
- `src/assets/i18n/de.json` - Deutsche Übersetzungen
- `src/assets/i18n/en.json` - Englische Übersetzungen

**Format:**
```json
{
  "COMMON": {
    "SAVE": "Speichern",
    "CANCEL": "Abbrechen",
    "DELETE": "Löschen"
  },
  "HEADER": {
    "TITLE": "Metadaten-Extraktion",
    "MODE_STANDALONE": "Standalone",
    "MODE_BOOKMARKLET": "Bookmarklet",
    "MODE_BROWSER_EXTENSION": "Browser Extension"
  },
  "INPUT": {
    "PLACEHOLDER": "Geben Sie Text oder URL ein...",
    "START_EXTRACTION": "Extraktion starten",
    "RESET": "Zurücksetzen"
  },
  "FIELD": {
    "INFO_BUTTON": "Feldinfo",
    "GEO_BUTTON": "Geocoding aktivieren",
    "STATUS_EMPTY": "Leer",
    "STATUS_FILLED": "Gefüllt",
    "STATUS_EXTRACTING": "Wird extrahiert...",
    "STATUS_ERROR": "Fehler"
  },
  "ALERTS": {
    "INPUT_REQUIRED": "Bitte geben Sie Text ein!",
    "SUCCESS": {
      "TITLE": "Erfolgreich gespeichert!",
      "MESSAGE": "Die Metadaten wurden erfolgreich im Repository gespeichert."
    },
    "ERROR": {
      "TITLE": "Fehler",
      "SUBMISSION_FAILED": "Fehler beim Speichern: {{error}}"
    }
  },
  "AI_PROMPTS": {
    "EXTRACTION": {
      "HEADER": "Extrahiere folgendes Metadatenfeld:",
      "VOCABULARY_HINT": "Nutze ausschließlich diese Labels (exakte Schreibweise):",
      "FORMAT_INSTRUCTION": "Antworte nur mit dem extrahierten Wert, ohne Zusatztext."
    },
    "NORMALIZATION": {
      "HEADER": "Normalisiere folgenden Wert:",
      "DATE_FORMAT": "Konvertiere Datum zu ISO 8601 (YYYY-MM-DD)",
      "URL_FORMAT": "Stelle sicher dass URL mit http:// oder https:// beginnt"
    },
    "CONTENT_TYPE": {
      "HEADER": "Analysiere den Text und bestimme den Content-Type:"
    }
  }
}
```

---

## I18nService

**Service:** `src/app/services/i18n.service.ts`

### API

#### 1. Sprache wechseln

```typescript
setLanguage(lang: 'de' | 'en'): void
```

**Beispiel:**
```typescript
this.i18n.setLanguage('en');  // Wechselt zu Englisch
```

#### 2. Aktuelle Sprache abfragen

```typescript
getCurrentLanguage(): 'de' | 'en'
```

**Beispiel:**
```typescript
const lang = this.i18n.getCurrentLanguage();  // → 'de' oder 'en'
```

#### 3. Sofort-Übersetzung

```typescript
instant(key: string, params?: object): string
```

**Beispiele:**
```typescript
// Einfach
this.i18n.instant('COMMON.SAVE')  // → "Speichern"

// Mit Parametern
this.i18n.instant('FOOTER.FIELDS_INFO', {
  total: 12,
  filled: 8
})  // → "8 von 12 Feldern gefüllt"
```

#### 4. Sprachwechsel beobachten

```typescript
currentLanguage$: Observable<'de' | 'en'>
```

**Beispiel:**
```typescript
this.i18n.currentLanguage$.subscribe(lang => {
  console.log(`Sprache geändert zu: ${lang}`);
  this.reloadData();  // Daten neu laden mit neuer Sprache
});
```

---

## Template-Integration

### 1. Pipe in Templates

**Einfach:**
```html
<button>{{ 'COMMON.SAVE' | translate }}</button>
<!-- Output (DE): Speichern -->
<!-- Output (EN): Save -->
```

**Mit Parametern:**
```html
<p>{{ 'FOOTER.FIELDS_INFO' | translate:{total: state.totalFields, filled: state.filledFields} }}</p>
<!-- Output (DE): 8 von 12 Feldern gefüllt -->
<!-- Output (EN): 8 of 12 fields filled -->
```

**In Attributen:**
```html
<input [placeholder]="'INPUT.PLACEHOLDER' | translate">
<!-- Output (DE): Geben Sie Text ein... -->
<!-- Output (EN): Enter text... -->
```

### 2. Instant in TypeScript

**Alert-Meldungen:**
```typescript
alert(this.i18n.instant('ALERTS.INPUT_REQUIRED'));
```

**Dynamische HTML-Generierung:**
```typescript
const dialogHTML = `
  <h2>${this.i18n.instant('ALERTS.SUCCESS.TITLE')}</h2>
  <p>${this.i18n.instant('ALERTS.SUCCESS.MESSAGE')}</p>
`;
```

**Konfigurations-Objekte:**
```typescript
const options = {
  placeholder: this.i18n.instant('INPUT.PLACEHOLDER'),
  label: this.i18n.instant('FIELD.LABEL')
};
```

---

## AI Prompt Localization

### Übersicht

Alle KI-Prompts sind mehrsprachig in `de.json` / `en.json` unter `AI_PROMPTS` gespeichert.

### Bereiche

**1. EXTRACTION** - Feldextraktion

```json
{
  "AI_PROMPTS": {
    "EXTRACTION": {
      "HEADER": "Extrahiere folgendes Metadatenfeld:",
      "LABEL": "Feld:",
      "TYPE": "Datentyp:",
      "DESCRIPTION": "Beschreibung:",
      "EXAMPLES": "Beispiele:",
      "VOCABULARY_HINT": "Nutze ausschließlich diese Labels:",
      "LABEL_EXACT_MATCH": "WICHTIG: Nutze Labels exakt wie angegeben, einschließlich Mehrwort-Bezeichnungen und Klammern (z.B. 'Hackathon (Wettbewerb)').",
      "FORMAT_INSTRUCTION": "Antworte nur mit dem extrahierten Wert, ohne Zusatztext.",
      "RETRY": {
        "ATTEMPT": "Versuch {{attempt}}/{{max}}:",
        "PREVIOUS_ERROR": "Vorheriger Versuch war fehlerhaft.",
        "INSTRUCTION": "Bitte antworte diesmal nur mit dem reinen Wert."
      }
    }
  }
}
```

**2. NORMALIZATION** - Datennormalisierung

```json
{
  "AI_PROMPTS": {
    "NORMALIZATION": {
      "HEADER": "Normalisiere folgenden Wert:",
      "FIELD": "Feld:",
      "VALUE": "Wert:",
      "DATATYPE": "Ziel-Typ:",
      "DATE_FORMAT": "Konvertiere Datum zu ISO 8601 (YYYY-MM-DD).",
      "URL_FORMAT": "Stelle sicher dass URL mit http:// oder https:// beginnt.",
      "NUMBER_FORMAT": "Konvertiere zu Zahl (auch Textzahlen wie 'zehn' → 10).",
      "BOOLEAN_FORMAT": "Konvertiere zu true/false.",
      "VOCABULARY_HINT": "Wähle Label aus Vokabular (Fuzzy-Match erlaubt):",
      "OUTPUT_INSTRUCTION": "Antworte nur mit dem normalisierten Wert."
    }
  }
}
```

**3. CONTENT_TYPE** - Content-Type-Erkennung

```json
{
  "AI_PROMPTS": {
    "CONTENT_TYPE": {
      "HEADER": "Analysiere den Text und bestimme den Content-Type:",
      "OPTIONS": "Mögliche Types:",
      "INSTRUCTION": "Antworte nur mit dem Type-Namen (z.B. 'event').",
      "FALLBACK": "Falls unklar, nutze 'learning_material'."
    }
  }
}
```

### Services mit lokalisierten Prompts

**1. FieldExtractionWorkerPoolService**

```typescript
buildExtractionPrompt(field: CanvasField, language: string): string {
  const t = (key: string, params?) => this.i18n.instant(key, params);
  
  let prompt = t('AI_PROMPTS.EXTRACTION.HEADER') + '\n';
  prompt += t('AI_PROMPTS.EXTRACTION.LABEL') + ' ' + field.label + '\n';
  
  if (field.vocabulary) {
    prompt += t('AI_PROMPTS.EXTRACTION.VOCABULARY_HINT') + '\n';
    field.vocabulary.concepts.forEach(c => {
      prompt += `- ${c.label}\n`;
    });
    prompt += '\n' + t('AI_PROMPTS.EXTRACTION.LABEL_EXACT_MATCH') + '\n';
  }
  
  return prompt;
}
```

**2. FieldNormalizerService**

```typescript
buildNormalizationPrompt(field: CanvasField, value: any): string {
  const t = (key: string) => this.i18n.instant(key);
  
  let prompt = t('AI_PROMPTS.NORMALIZATION.HEADER') + '\n';
  prompt += t('AI_PROMPTS.NORMALIZATION.FIELD') + ' ' + field.label + '\n';
  prompt += t('AI_PROMPTS.NORMALIZATION.VALUE') + ' ' + value + '\n';
  
  if (field.datatype === 'date') {
    prompt += t('AI_PROMPTS.NORMALIZATION.DATE_FORMAT') + '\n';
  }
  
  return prompt;
}
```

**3. CanvasService**

```typescript
buildContentTypePrompt(text: string): string {
  const t = (key: string) => this.i18n.instant(key);
  
  let prompt = t('AI_PROMPTS.CONTENT_TYPE.HEADER') + '\n';
  prompt += t('AI_PROMPTS.CONTENT_TYPE.OPTIONS') + '\n';
  // ... available content types
  prompt += t('AI_PROMPTS.CONTENT_TYPE.INSTRUCTION');
  
  return prompt;
}
```

---

## Sprachwechsel-Workflow

### User-Aktion

```
User klickt Language Switcher: DE → EN
```

### 1. UI-Ebene (sofort)

```typescript
// Alle Template-Pipes aktualisieren sich automatisch
{{ 'COMMON.SAVE' | translate }}  // "Speichern" → "Save"
```

### 2. Schema-Ebene (re-localization)

```typescript
// CanvasService hört auf Observable
this.i18n.currentLanguage$.subscribe(lang => {
  this.relocalizeAllFields(lang);
});

// Alle Felder neu lokalisieren
relocalizeAllFields('en') {
  this.coreFields = this.coreFields.map(field => {
    const fieldDef = this.getFieldDefinition(field.fieldId);
    return this.localizer.localizeField(fieldDef, 'en');
  });
  
  // State-Update triggert Change Detection
  this.updateState({ coreFields: [...this.coreFields] });
}
```

### 3. Vokabular-Chips

```typescript
// canvas-field.component.ts
ngOnChanges() {
  if (this.field.vocabulary) {
    // Vokabular hat neue Labels (EN)
    this.filteredOptions = this.field.vocabulary.concepts.map(c => c.label);
    
    // Gespeicherte Werte (DE) werden über label_de gemappt
    this.displayValue = this.getVocabularyLabel(this.field.value);
  }
}

getVocabularyLabel(value: string): string {
  const concept = this.field.vocabulary.concepts.find(c =>
    c.label === value ||      // Aktuelles Label
    c.label_de === value ||   // DE-Matching ✅
    c.label_en === value ||   // EN-Matching
    c.uri === value
  );
  return concept?.label;  // → Gibt EN-Label zurück
}
```

### 4. KI-Prompts

```typescript
// Nächste Extraktion nutzt automatisch EN-Prompts
buildExtractionPrompt(field) {
  const lang = this.i18n.getCurrentLanguage();  // → 'en'
  const t = (key) => this.i18n.instant(key);    // Nutzt en.json
  
  return t('AI_PROMPTS.EXTRACTION.HEADER') + ...;  // Englischer Prompt
}
```

---

## Neue Übersetzungen hinzufügen

### 1. Schlüssel in de.json und en.json hinzufügen

**de.json:**
```json
{
  "NEW_FEATURE": {
    "TITLE": "Neues Feature",
    "DESCRIPTION": "Dies ist ein neues Feature"
  }
}
```

**en.json:**
```json
{
  "NEW_FEATURE": {
    "TITLE": "New Feature",
    "DESCRIPTION": "This is a new feature"
  }
}
```

### 2. In Template nutzen

```html
<h2>{{ 'NEW_FEATURE.TITLE' | translate }}</h2>
<p>{{ 'NEW_FEATURE.DESCRIPTION' | translate }}</p>
```

### 3. In TypeScript nutzen

```typescript
const title = this.i18n.instant('NEW_FEATURE.TITLE');
alert(this.i18n.instant('NEW_FEATURE.DESCRIPTION'));
```

---

## Best Practices

### ✅ DO

- Nutze **semantische Schlüssel** (z.B. `ALERTS.INPUT_REQUIRED` statt `MSG_1`)
- Gruppiere Übersetzungen **logisch** (z.B. `HEADER.*`, `FOOTER.*`)
- Nutze **Parametrisierung** für dynamische Texte
- Teste **beide Sprachen** nach Änderungen
- Füge **Kommentare** in JSON hinzu (falls nötig)

### ❌ DON'T

- Hardcode **keine Texte** in Templates oder Code
- Verwende **keine Inline-Übersetzungen**
- Mische **nicht** deutsche und englische Schlüssel
- Vergiss **nicht** Übersetzungen in beiden Dateien hinzuzufügen

---

## Siehe auch

- **[SCHEMA_I18N.md](./SCHEMA_I18N.md)** - Schema-Datenstruktur i18n
- **Language Files:** `src/assets/i18n/de.json`, `en.json`
- **Service:** `src/app/services/i18n.service.ts`
- **Localizer:** `src/app/services/schema-localizer.service.ts`
