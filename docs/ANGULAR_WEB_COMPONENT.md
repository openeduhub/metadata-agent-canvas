# Metadata Agent Canvas - Angular Web Component

Die Metadata Agent Canvas Komponente kann als **Web Component (Custom Element)** in beliebige Webanwendungen eingebunden werden.

## Inhaltsverzeichnis

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Einbindung](#einbindung)
- [Input Properties](#input-properties)
- [Output Events](#output-events)
- [JSON-Daten laden](#json-daten-laden)
- [JSON-Daten empfangen](#json-daten-empfangen)
- [URL-Parameter](#url-parameter)
- [Beispiele](#beispiele)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://your-domain.com/metadata-agent/styles.css">
</head>
<body>
  <!-- Web Component einbinden -->
  <metadata-agent-canvas id="canvas"></metadata-agent-canvas>
  
  <!-- Scripts laden (Reihenfolge wichtig!) -->
  <script src="https://your-domain.com/metadata-agent/runtime.js"></script>
  <script src="https://your-domain.com/metadata-agent/polyfills.js"></script>
  <script src="https://your-domain.com/metadata-agent/main.js"></script>
  
  <script>
    // Warten bis Custom Element registriert ist
    customElements.whenDefined('metadata-agent-canvas').then(() => {
      const canvas = document.getElementById('canvas');
      
      // Konfiguration setzen
      canvas.viewerMode = true;
      canvas.readonly = true;
      
      // JSON laden
      canvas.metadataInput = { /* ... */ };
      
      // Auf Änderungen reagieren
      canvas.addEventListener('metadataChange', (e) => {
        console.log('Metadata:', e.detail);
      });
    });
  </script>
</body>
</html>
```

---

## Installation

### 1. Build erstellen

```bash
cd metadata-agent-canvas-oeh
npm install
npm run build:prod
```

### 2. Dateien bereitstellen

Nach dem Build liegen die Dateien in `dist/`:

```
dist/
├── runtime.*.js        # Angular Runtime
├── polyfills.*.js      # Browser Polyfills
├── main.*.js           # Hauptanwendung
├── styles.*.css        # Styles
└── assets/             # i18n, Schemas, etc.
    ├── i18n/
    ├── schemata/
    └── examples/
```

Diese Dateien auf einem Webserver bereitstellen (Netlify, Vercel, nginx, etc.).

---

## Einbindung

### HTML-Element

```html
<metadata-agent-canvas></metadata-agent-canvas>
```

### Scripts laden

**Wichtig:** Die Scripts müssen in dieser Reihenfolge geladen werden:

```html
<!-- 1. Styles -->
<link rel="stylesheet" href="path/to/styles.css">

<!-- 2. Scripts (am Ende des body) -->
<script src="path/to/runtime.js"></script>
<script src="path/to/polyfills.js"></script>
<script src="path/to/main.js"></script>
```

### Warten auf Registrierung

```javascript
// Sicherstellen, dass das Custom Element verfügbar ist
await customElements.whenDefined('metadata-agent-canvas');

const canvas = document.querySelector('metadata-agent-canvas');
// Jetzt kann das Element konfiguriert werden
```

---

## Input Properties

Alle Properties können via JavaScript gesetzt werden:

| Property | Typ | Default | Beschreibung |
|----------|-----|---------|--------------|
| `metadataInput` | `object` | `null` | JSON-Metadaten zum Anzeigen/Bearbeiten |
| `viewerMode` | `boolean` | `false` | Viewer-Modus (kein Input-Feld, kein Footer) |
| `readonly` | `boolean` | `false` | Read-Only (alle Felder deaktiviert) |
| `compactMode` | `boolean` | `false` | Kompakte UI mit Floating Controls |
| `controls` | `boolean` | `true` | Zeigt Control-Buttons (JSON-Loader, Sprache) |
| `showCoreFields` | `boolean` | `true` | Zeigt Core-Felder (Titel, Beschreibung, etc.) |
| `showSpecialFields` | `boolean` | `true` | Zeigt Zusatzfelder (Event, Organisation, etc.) |
| `showFieldActions` | `boolean` | `true` | Zeigt Aktions-Icons (Status, Dropdown, Geo) |

### Beispiel: Properties setzen

```javascript
const canvas = document.querySelector('metadata-agent-canvas');

// Viewer-Modus aktivieren
canvas.viewerMode = true;
canvas.readonly = true;

// Controls ausblenden
canvas.controls = false;

// Nur Zusatzfelder anzeigen (ohne Core-Felder)
canvas.showCoreFields = false;
canvas.showSpecialFields = true;

// Aktions-Icons ausblenden (für saubere Anzeige)
canvas.showFieldActions = false;
```

---

## Output Events

Die Komponente emittiert `CustomEvent`s, auf die Sie reagieren können:

| Event | Payload | Beschreibung |
|-------|---------|--------------|
| `metadataChange` | `CustomEvent<object>` | Wird bei jeder Feldänderung emittiert |
| `metadataSubmit` | `CustomEvent<object>` | Wird bei Klick auf Submit emittiert |

### Beispiel: Events abonnieren

```javascript
const canvas = document.querySelector('metadata-agent-canvas');

// Bei jeder Änderung
canvas.addEventListener('metadataChange', (event) => {
  console.log('Metadata geändert:', event.detail);
  
  // Beispiel: Aktuellen Stand in localStorage speichern
  localStorage.setItem('draft', JSON.stringify(event.detail));
});

// Bei Submit
canvas.addEventListener('metadataSubmit', (event) => {
  console.log('Metadata zum Speichern:', event.detail);
  
  // Beispiel: An Backend senden
  fetch('/api/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event.detail)
  });
});
```

---

## JSON-Daten laden

### Struktur der JSON-Daten

```json
{
  "cclom:title": {
    "value": "Workshop: KI in der Bildung",
    "fieldId": "cclom:title",
    "label": { "de": "Titel", "en": "Title" },
    "datatype": "text",
    "isRequired": true
  },
  "cclom:general_description": {
    "value": "Ein Workshop über künstliche Intelligenz...",
    "fieldId": "cclom:general_description",
    "label": { "de": "Beschreibung", "en": "Description" },
    "datatype": "text"
  },
  "ccm:oeh_event_dateRange": {
    "value": "2025-03-15",
    "fieldId": "ccm:oeh_event_dateRange",
    "label": { "de": "Veranstaltungsdatum", "en": "Event Date" },
    "datatype": "date"
  }
}
```

### Via Property

```javascript
const canvas = document.querySelector('metadata-agent-canvas');

// Direkt JSON-Objekt übergeben
canvas.metadataInput = {
  "cclom:title": {
    "value": "Mein Titel",
    "fieldId": "cclom:title"
  },
  // ... weitere Felder
};
```

### Via Fetch

```javascript
const canvas = document.querySelector('metadata-agent-canvas');

// JSON von Server laden
const response = await fetch('/api/metadata/123');
const metadata = await response.json();

canvas.metadataInput = metadata;
```

### Via File Input

```javascript
const fileInput = document.getElementById('file-input');
const canvas = document.querySelector('metadata-agent-canvas');

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  const text = await file.text();
  const metadata = JSON.parse(text);
  
  canvas.metadataInput = metadata;
});
```

---

## JSON-Daten empfangen

### Bei jeder Änderung

```javascript
const canvas = document.querySelector('metadata-agent-canvas');

canvas.addEventListener('metadataChange', (event) => {
  const metadata = event.detail;
  
  // Struktur:
  // {
  //   "cclom:title": { "value": "...", "fieldId": "...", ... },
  //   "cclom:general_description": { "value": "...", ... },
  //   ...
  // }
  
  console.log('Titel:', metadata['cclom:title']?.value);
});
```

### Bei Submit

```javascript
canvas.addEventListener('metadataSubmit', (event) => {
  const metadata = event.detail;
  
  // An Backend senden
  saveMetadata(metadata);
});
```

### Manuell abrufen

```javascript
// Falls die Komponente eine getMetadata() Methode exponiert
const metadata = canvas.getMetadata();
```

---

## URL-Parameter

Alternativ zu JavaScript-Properties können Parameter via URL gesetzt werden:

```
https://example.com/viewer.html?mode=viewer&readonly=true&coreFields=false
```

| URL-Parameter | Entspricht Property | Beispiel |
|---------------|---------------------|----------|
| `mode=viewer` | `viewerMode=true` | Viewer-Modus |
| `readonly=true` | `readonly=true` | Nur lesen |
| `ui=compact` | `compactMode=true` | Kompakte UI |
| `controls=false` | `controls=false` | Keine Controls |
| `coreFields=false` | `showCoreFields=false` | Keine Core-Felder |
| `specialFields=false` | `showSpecialFields=false` | Keine Zusatzfelder |
| `fieldActions=false` | `showFieldActions=false` | Keine Aktions-Icons |
| `autoload=file.json` | - | JSON automatisch laden |

### Priorität

1. **JavaScript-Properties** haben Vorrang
2. **URL-Parameter** werden als Fallback verwendet

---

## Beispiele

### Beispiel 1: Einfacher Viewer

```html
<!DOCTYPE html>
<html>
<head>
  <title>Metadata Viewer</title>
  <link rel="stylesheet" href="./dist/styles.css">
  <style>
    metadata-agent-canvas {
      display: block;
      width: 100%;
      height: 100vh;
    }
  </style>
</head>
<body>
  <metadata-agent-canvas id="canvas"></metadata-agent-canvas>
  
  <script src="./dist/runtime.js"></script>
  <script src="./dist/polyfills.js"></script>
  <script src="./dist/main.js"></script>
  
  <script>
    customElements.whenDefined('metadata-agent-canvas').then(async () => {
      const canvas = document.getElementById('canvas');
      
      // Viewer-Konfiguration
      canvas.viewerMode = true;
      canvas.readonly = true;
      canvas.controls = false;
      canvas.showFieldActions = false;
      
      // Daten laden
      const response = await fetch('./example.json');
      canvas.metadataInput = await response.json();
    });
  </script>
</body>
</html>
```

### Beispiel 2: Nur Zusatzfelder anzeigen

```javascript
const canvas = document.querySelector('metadata-agent-canvas');

// Nur Event-spezifische Felder, keine Core-Felder
canvas.showCoreFields = false;
canvas.showSpecialFields = true;

// Saubere Anzeige ohne Icons
canvas.showFieldActions = false;
canvas.readonly = true;
```

### Beispiel 3: Editierbar mit Auto-Save

```javascript
const canvas = document.querySelector('metadata-agent-canvas');
let saveTimeout;

canvas.addEventListener('metadataChange', (event) => {
  // Debounce: Speichern nach 1 Sekunde ohne Änderung
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    localStorage.setItem('metadata-draft', JSON.stringify(event.detail));
    console.log('Auto-saved');
  }, 1000);
});

// Beim Laden: Draft wiederherstellen
const draft = localStorage.getItem('metadata-draft');
if (draft) {
  canvas.metadataInput = JSON.parse(draft);
}
```

### Beispiel 4: In iframe einbetten

```html
<!-- Host-Seite -->
<iframe 
  id="metadata-frame"
  src="https://your-domain.com/metadata-agent/?mode=viewer&readonly=true"
  width="100%" 
  height="800"
  frameborder="0">
</iframe>

<script>
  const iframe = document.getElementById('metadata-frame');
  
  // Daten an iframe senden (postMessage)
  iframe.contentWindow.postMessage({
    type: 'SET_PAGE_DATA',
    text: 'Beschreibungstext...',
    url: 'https://example.com'
  }, '*');
</script>
```

### Beispiel 5: Sidebar-Integration

```html
<div class="app-container">
  <main class="content">
    <!-- Hauptinhalt -->
  </main>
  
  <aside class="sidebar" style="width: 500px;">
    <metadata-agent-canvas id="canvas"></metadata-agent-canvas>
  </aside>
</div>

<style>
  .app-container {
    display: flex;
    height: 100vh;
  }
  
  .content {
    flex: 1;
    overflow-y: auto;
  }
  
  .sidebar {
    border-left: 1px solid #ddd;
    overflow: hidden;
  }
  
  metadata-agent-canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
```

---

## Troubleshooting

### "metadata-agent-canvas is not defined"

**Ursache:** Scripts nicht in richtiger Reihenfolge geladen.

**Lösung:**
```html
<script src="runtime.js"></script>   <!-- 1. Zuerst -->
<script src="polyfills.js"></script> <!-- 2. Dann -->
<script src="main.js"></script>      <!-- 3. Zuletzt -->
```

### Styles fehlen

**Ursache:** CSS nicht geladen.

**Lösung:**
```html
<link rel="stylesheet" href="styles.css">
```

### CORS-Fehler

**Ursache:** Assets werden von anderem Origin geladen.

**Lösung:** Server muss CORS-Header setzen:
```
Access-Control-Allow-Origin: *
```

### Assets (i18n, Schemas) nicht gefunden

**Ursache:** `assets/` Ordner nicht im selben Verzeichnis wie JS-Dateien.

**Lösung:** Kompletten `dist/` Ordner bereitstellen, inklusive `assets/`.

### Felder werden nicht angezeigt

**Ursache:** JSON-Struktur stimmt nicht.

**Lösung:** Prüfen Sie, ob die JSON die richtige Struktur hat:
```json
{
  "fieldId": {
    "value": "...",
    "fieldId": "..."
  }
}
```

---

## Technische Details

### Browser-Unterstützung

- Chrome 67+
- Firefox 63+
- Safari 12.1+
- Edge 79+

### Bundle-Größe

- JavaScript: ~200 KB (gzipped)
- CSS: ~6 KB (gzipped)

### Dependencies

- Angular 19
- Angular Material (Material Design 3)
- ngx-translate (i18n)

---

## Weitere Ressourcen

- [WEB_COMPONENT_INTEGRATION.md](./WEB_COMPONENT_INTEGRATION.md) - Technische Details
- [VIEWER_MODE.md](../VIEWER_MODE.md) - Viewer-Modus Dokumentation
- [README.md](../README.md) - Projekt-Übersicht
