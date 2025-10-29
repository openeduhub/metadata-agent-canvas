# Development Guide

**Entwickler-Guide für Metadata Agent Canvas**

---

## 🛠️ Entwicklungsumgebung

### Voraussetzungen

- **Node.js** 18+ und npm
- **Angular CLI** 18+
- **Git**
- **VS Code** (empfohlen) mit Extensions:
  - Angular Language Service
  - ESLint
  - Prettier

### Setup

```bash
# Repository klonen
git clone <repository-url>
cd webkomponente-canvas

# Dependencies installieren
npm install

# Angular CLI global installieren (optional)
npm install -g @angular/cli
```

---

## 🚀 Development Server

### Standard Development

```bash
npm start
# oder
ng serve
```

**App läuft auf:** http://localhost:4200

**Features:**
- Hot Reload bei Code-Änderungen
- Source Maps für Debugging
- Angular DevTools Integration

---

### Mit Netlify Dev (empfohlen)

```bash
npm install -g netlify-cli
netlify dev
```

**Vorteile:**
- Netlify Functions lokal testen
- Environment Variables aus Netlify laden
- Identische Umgebung wie Production
- CORS automatisch gehandhabt

**App läuft auf:** http://localhost:8888

---

### Lokaler Proxy

**Falls du Functions nicht benötigst:**

```bash
npm run proxy
```

**Startet:** `local-universal-proxy.js` auf Port 3001

**Routen:**
- `/llm` → OpenAI/B-API Proxy
- `/repository` → Repository API Proxy
- `/geocode` → Geocoding Proxy

---

## 📁 Projektstruktur

```
webkomponente-canvas/
│
├── src/
│   ├── app/
│   │   ├── components/         # Angular Components
│   │   │   ├── canvas-view/    # Haupt-Canvas Component
│   │   │   ├── canvas-field/   # Einzelnes Feld Component
│   │   │   └── language-switcher/
│   │   ├── services/           # Services
│   │   │   ├── canvas.service.ts
│   │   │   ├── i18n.service.ts
│   │   │   ├── schema-localizer.service.ts
│   │   │   ├── field-extraction-worker-pool.service.ts
│   │   │   ├── field-normalizer.service.ts
│   │   │   └── platform-detection.service.ts
│   │   ├── models/             # TypeScript Interfaces
│   │   └── app.component.ts    # Root Component
│   │
│   ├── assets/
│   │   └── i18n/               # Translation Files
│   │       ├── de.json
│   │       └── en.json
│   │
│   ├── schemata/               # Schema Definitions (JSON)
│   │   ├── core.json
│   │   ├── event.json
│   │   ├── education_offer.json
│   │   └── ...
│   │
│   ├── environments/           # Environment Config
│   │   ├── environment.ts      # Development
│   │   └── environment.prod.ts # Production
│   │
│   └── styles.scss             # Global Styles
│
├── netlify/
│   └── functions/              # Netlify Functions
│       ├── openai-proxy.js
│       ├── b-api-proxy.js
│       └── guest-submit.js
│
├── docs/                       # Documentation
├── .env.template               # Environment Template
└── netlify.toml                # Netlify Config
```

---

## 🔧 Wichtige Services

### CanvasService

**Datei:** `src/app/services/canvas.service.ts`

**Verantwortlich für:**
- State Management (BehaviorSubject)
- Schema laden & lokalisieren
- Content-Type Detection
- Feld-Extraktion koordinieren
- Normalisierung koordinieren
- JSON-Export

**Wichtige Methoden:**

```typescript
// Schema laden
loadSchemaForContentType(contentType: string): void

// Extraktion starten
startExtraction(text: string, contentType: string): void

// Feld-Wert setzen
setFieldValue(fieldId: string, value: any): void

// JSON generieren
generateJSON(): any

// Sprache wechseln (re-localization)
relocalizeAllFields(language: string): void
```

---

### I18nService

**Datei:** `src/app/services/i18n.service.ts`

**Verantwortlich für:**
- Sprachwechsel
- Translation File Loading
- Persistierung in localStorage

**Wichtige Methoden:**

```typescript
// Sprache wechseln
setLanguage(lang: 'de' | 'en'): void

// Aktuelle Sprache
getCurrentLanguage(): 'de' | 'en'

// Sofort-Übersetzung
instant(key: string, params?): string

// Observable für Sprachwechsel
currentLanguage$: Observable<'de' | 'en'>
```

---

### SchemaLocalizerService

**Datei:** `src/app/services/schema-localizer.service.ts`

**Verantwortlich für:**
- Schema-Daten lokalisieren
- Vokabulare lokalisieren
- Labels extrahieren

**Wichtige Methoden:**

```typescript
// String lokalisieren
localizeString(value: any, language: string): string

// Feld lokalisieren
localizeField(field: any, language: string): CanvasField

// Vokabular lokalisieren
localizeVocabulary(vocab: any, language: string): Vocabulary

// Beispiele lokalisieren
localizeExamples(examples: any, language: string): string[]
```

---

### FieldExtractionWorkerPoolService

**Datei:** `src/app/services/field-extraction-worker-pool.service.ts`

**Verantwortlich für:**
- Parallele Feld-Extraktion
- Worker Pool Management
- Prompt Building
- API-Calls an LLM

**Worker Pool Konfiguration:**

```typescript
// environment.ts
canvas: {
  maxWorkers: 10,       // Anzahl paralleler Worker
  timeout: 30000        // Timeout pro Feld (ms)
}
```

---

### FieldNormalizerService

**Datei:** `src/app/services/field-normalizer.service.ts`

**Verantwortlich für:**
- 3-Stufen-Normalisierung
- Lokale Normalisierung (Datum, URL, Boolean)
- Fuzzy-Matching für Vokabulare
- LLM-Fallback bei Bedarf

**Normalisierungs-Pipeline:**

```typescript
normalizeField(field: CanvasField, value: any): Observable<any> {
  // Stufe 1: Lokale Normalisierung (< 1ms)
  const localNormalized = this.localNormalization(value, field.datatype);
  
  // Stufe 2: Fuzzy-Matching (< 5ms)
  if (field.vocabulary) {
    return this.fuzzyMatch(localNormalized, field.vocabulary);
  }
  
  // Stufe 3: LLM-Fallback (2-4 Sekunden)
  if (needsLLM) {
    return this.llmNormalization(localNormalized, field);
  }
  
  return of(localNormalized);
}
```

---

### PlatformDetectionService

**Datei:** `src/app/services/platform-detection.service.ts`

**Verantwortlich für:**
- Platform Detection (Netlify/Vercel/Local)
- Proxy URL Bereitstellung
- Runtime Hostname Check

**Platform-spezifische URLs:**

```typescript
getOpenAIProxyUrl(): string {
  switch (this.platform) {
    case 'netlify': return '/.netlify/functions/openai-proxy';
    case 'vercel':  return '/api/openai-proxy';
    case 'local':   return 'http://localhost:3001/llm';
    default:        return this.runtimeFallback();
  }
}
```

---

## 🎨 Komponenten

### CanvasViewComponent

**Datei:** `src/app/components/canvas-view/canvas-view.component.ts`

**Template:** Haupt-UI mit Input, Progress, Canvas, Footer

**Wichtige Features:**
- State Subscription (`canvas.state$`)
- Input Handling
- Content-Type Selection
- JSON Export
- Language Switcher Integration

---

### CanvasFieldComponent

**Datei:** `src/app/components/canvas-field/canvas-field.component.ts`

**Template:** Einzelnes Feld mit Status, Label, Input, Info-Button

**Input Types:**
- Text Input (String, Number)
- Chips (Multiple Values, Vocabulary)
- Date Input (mit Autocomplete)
- URL Input (mit Validation)
- Textarea (Long Text)

**Features:**
- Autocomplete für Vokabulare
- Fuzzy-Matching
- Geo-Icon (bei Location-Feldern)
- Info-Button (Beschreibung anzeigen)
- Sub-Fields Rendering (Tree-Lines)

---

## 🧪 Testing

### Unit Tests

```bash
ng test
```

**Framework:** Jasmine + Karma

**Test-Dateien:** `*.spec.ts`

**Beispiel:**

```typescript
describe('I18nService', () => {
  it('should switch language', () => {
    service.setLanguage('en');
    expect(service.getCurrentLanguage()).toBe('en');
  });
});
```

---

### E2E Tests

```bash
ng e2e
```

**Framework:** Playwright (empfohlen) oder Cypress

---

## 🏗️ Build

### Development Build

```bash
ng build
```

**Output:** `dist/` (nicht optimiert)

---

### Production Build

```bash
ng build --configuration production
# oder
npm run build
```

**Output:** `dist/` (optimiert, minified)

**Features:**
- Tree-Shaking
- Minification
- AOT Compilation
- Source Maps (optional)

---

### Bundle Analysis

```bash
npm install -g webpack-bundle-analyzer
ng build --stats-json
webpack-bundle-analyzer dist/stats.json
```

**Zeigt:** Bundle-Größe, Dependencies, Code-Splitting

---

## 🎨 Styling

### Material Design v3

**Theme:** `src/theme.scss`

**Custom Properties:**

```scss
:root {
  --md-sys-color-primary: #0062ac;
  --md-sys-color-secondary: #006693;
  --md-sys-color-tertiary: #00874d;
  --md-sys-color-error: #ba1a1a;
}
```

**Shape System:**

```scss
--md-sys-shape-corner-extra-small: 4px;
--md-sys-shape-corner-small: 8px;
--md-sys-shape-corner-medium: 12px;
--md-sys-shape-corner-large: 16px;
```

---

### Component Styles

**Scoped Styles:** `component.scss`

```scss
:host {
  display: block;
}

.my-element {
  border-radius: var(--md-sys-shape-corner-medium);
  background: var(--md-sys-color-surface);
}
```

**Global Styles:** `src/styles.scss`

---

## 📚 Schema Development

### Schema-Struktur (mit i18n)

```json
{
  "id": "cclom:title",
  "group": "description",
  "label": {
    "de": "Titel",
    "en": "Title"
  },
  "description": {
    "de": "Aussagekräftiger Titel der Ressource.",
    "en": "Concise title of the resource."
  },
  "examples": {
    "de": ["Zukunft der Hochschullehre"],
    "en": ["Future of Higher Education"]
  },
  "prompt": {
    "de": "Extrahiere den Titel",
    "en": "Extract the title"
  },
  "system": {
    "path": "cclom:title",
    "uri": "http://...",
    "datatype": "string",
    "multiple": false,
    "required": true,
    "ask_user": true,
    "ai_fillable": true
  }
}
```

### Neues Schema erstellen

**1. Schema-Datei erstellen:**

```bash
touch src/schemata/my-new-schema.json
```

**2. Basis-Struktur kopieren:**

```json
{
  "contentType": "my-type",
  "groups": [
    {
      "id": "description",
      "label": { "de": "Beschreibung", "en": "Description" }
    }
  ],
  "fields": [
    {
      "id": "cclom:title",
      "group": "description",
      "label": { "de": "Titel", "en": "Title" },
      "system": { ... }
    }
  ]
}
```

**3. Felder hinzufügen** (siehe Schema-Struktur oben)

**4. Schema registrieren:**

```typescript
// src/app/services/canvas.service.ts
private async loadSchema(contentType: string): Promise<any> {
  const schemaPath = `assets/schemata/${contentType}.json`;
  return firstValueFrom(this.http.get(schemaPath));
}
```

---

### Vokabulare hinzufügen

```json
{
  "vocabulary": {
    "type": "closed",
    "concepts": [
      {
        "label": {
          "de": "Grundschule",
          "en": "primary school"
        },
        "uri": "http://...",
        "description": {
          "de": "Bildungsstufe für Kinder von 6-10 Jahren",
          "en": "Education level for children aged 6-10"
        },
        "altLabels": {
          "de": ["Primarstufe", "GS"],
          "en": ["primary level", "elementary school"]
        }
      }
    ]
  }
}
```

**Vocabulary Types:**
- `closed` - Nur Werte aus Liste erlaubt
- `open` - Freie Eingabe + Vorschläge
- `skos` - SKOS-Thesaurus

---

## 🌐 i18n Development

### Translation Files bearbeiten

**Dateien:**
- `src/assets/i18n/de.json`
- `src/assets/i18n/en.json`

**Struktur:**

```json
{
  "COMMON": {
    "SAVE": "Speichern",
    "CANCEL": "Abbrechen"
  },
  "NEW_FEATURE": {
    "TITLE": "Neues Feature",
    "DESCRIPTION": "Beschreibung"
  }
}
```

### In Template nutzen

```html
<!-- Einfach -->
<button>{{ 'COMMON.SAVE' | translate }}</button>

<!-- Mit Parametern -->
<p>{{ 'NEW_FEATURE.DESCRIPTION' | translate:{name: userName} }}</p>

<!-- In Attributen -->
<input [placeholder]="'INPUT.PLACEHOLDER' | translate">
```

### In TypeScript nutzen

```typescript
constructor(private i18n: I18nService) {}

showAlert() {
  alert(this.i18n.instant('ALERTS.SUCCESS.MESSAGE'));
}

getMessage() {
  return this.i18n.instant('MESSAGE', {count: 5});
}
```

---

## 🔧 Environment Variables

### Lokale Entwicklung

**Datei:** `.env`

```bash
# Platform
DEPLOYMENT_PLATFORM=local

# LLM Provider
LLM_PROVIDER=b-api-openai

# API-Keys
OPENAI_API_KEY=sk-proj-...
B_API_KEY=...
```

### Neue Variable hinzufügen

**1. .env.template updaten:**

```bash
# Neue Variable
MY_NEW_VAR=default-value
```

**2. In environment.ts nutzen:**

```typescript
export const environment = {
  myNewVar: process.env['MY_NEW_VAR'] || 'default'
};
```

**3. Dokumentieren in ENVIRONMENT_VARIABLES.md**

---

## 🐛 Debugging

### Browser DevTools

**Sources Tab:**
- Setze Breakpoints in `.ts` Dateien
- Step through Code
- Inspect Variables

**Console:**
- `console.log()` Statements
- Error Stack Traces

**Network Tab:**
- API-Calls inspizieren
- Request/Response prüfen
- Timing analysieren

---

### Angular DevTools

**Installation:** Chrome Extension "Angular DevTools"

**Features:**
- Component Tree inspizieren
- Change Detection profilen
- State inspizieren
- Performance analysieren

---

### VS Code Debugging

**launch.json:**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Angular",
      "url": "http://localhost:4200",
      "webRoot": "${workspaceFolder}"
    }
  ]
}
```

**Start:** F5

---

## 📦 Dependencies

### Wichtige Packages

**Angular:**
- `@angular/core`: ^18.0.0
- `@angular/material`: ^18.0.0
- `@angular/forms`: ^18.0.0

**i18n:**
- `@ngx-translate/core`: ^15.0.0
- `@ngx-translate/http-loader`: ^8.0.0

**Utilities:**
- `rxjs`: ^7.8.0
- `tslib`: ^2.6.0

### Update Dependencies

```bash
# Check for updates
npm outdated

# Update all
npm update

# Update Angular
ng update @angular/core @angular/cli
```

---

## 🚀 Best Practices

### Code Style

**TypeScript:**
- Use strict mode
- Explicit types
- Avoid `any`

**Angular:**
- OnPush Change Detection wo möglich
- Unsubscribe in ngOnDestroy
- Async Pipe bevorzugen

**Naming:**
- Components: `PascalCase`
- Services: `PascalCase`
- Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

---

### Performance

**Lazy Loading:**
```typescript
// Nicht alles sofort laden
const routes: Routes = [
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module')
  }
];
```

**TrackBy Functions:**
```html
<div *ngFor="let item of items; trackBy: trackByFn">
```

**OnPush Strategy:**
```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush
})
```

---

### Security

**Sanitization:**
```typescript
import { DomSanitizer } from '@angular/platform-browser';

// HTML sanitizen
this.sanitizer.sanitize(SecurityContext.HTML, html);
```

**XSS Prevention:**
- Nie `innerHTML` mit User-Input
- Immer Template-Syntax nutzen
- Sanitizer nutzen bei Bedarf

---

## 📚 Weitere Ressourcen

**Angular:**
- [Angular Docs](https://angular.dev/)
- [Angular Material](https://material.angular.io/)
- [RxJS](https://rxjs.dev/)

**Projekt-Docs:**
- [FEATURES.md](./FEATURES.md)
- [SCHEMA_I18N.md](./SCHEMA_I18N.md)
- [INTERNATIONALIZATION.md](./INTERNATIONALIZATION.md)

---

**🎯 Happy Coding!**
