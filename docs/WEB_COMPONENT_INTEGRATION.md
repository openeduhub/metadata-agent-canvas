# Metadata Agent als Web Component einbinden

Die Angular-App kann als **Web Component** (Custom Element) in jede HTML-Seite eingebunden werden.

## API

### Input Properties

| Property | Typ | Default | Beschreibung |
|----------|-----|---------|--------------|
| `metadataInput` | `object` | `null` | JSON-Metadaten zum Anzeigen/Bearbeiten |
| `viewerMode` | `boolean` | `false` | Viewer-Modus (kein Input, kein Footer) |
| `readonly` | `boolean` | `false` | Read-Only (alle Felder deaktiviert) |
| `compactMode` | `boolean` | `false` | Kompakte UI mit Floating Controls |
| `controls` | `boolean` | `true` | Zeigt Control-Buttons (JSON-Loader, Sprache) |
| `showCoreFields` | `boolean` | `true` | Zeigt Core-Felder (Titel, Beschreibung, etc.) |
| `showSpecialFields` | `boolean` | `true` | Zeigt Zusatzfelder (Event, Organisation, etc.) |
| `showFieldActions` | `boolean` | `true` | Zeigt Aktions-Icons in Feldern (Status, Dropdown, Geo) |

### Output Events

| Event | Payload | Beschreibung |
|-------|---------|--------------|
| `metadataChange` | `CustomEvent<object>` | Wird bei jeder Feldänderung emittiert |
| `metadataSubmit` | `CustomEvent<object>` | Wird bei Klick auf Submit emittiert |

### Beispiel: Vollständige Integration

```javascript
const canvas = document.querySelector('metadata-agent-canvas');

// === INPUT: Konfiguration ===

// Viewer-Modus mit Read-Only
canvas.viewerMode = true;
canvas.readonly = true;
canvas.controls = false;

// Nur Zusatzfelder anzeigen (ohne Core-Felder)
canvas.showCoreFields = false;
canvas.showSpecialFields = true;

// Metadata laden
canvas.metadataInput = {
  "cclom:title": { "value": "Mein Titel", ... },
  "ccm:oeh_event_dateRange": { "value": "2025-03-15", ... }
};

// === OUTPUT: Events abonnieren ===

canvas.addEventListener('metadataChange', (event) => {
  console.log('Metadata geändert:', event.detail);
});

canvas.addEventListener('metadataSubmit', (event) => {
  console.log('Metadata zum Speichern:', event.detail);
  saveToBackend(event.detail);
});
```

### URL-Parameter (Alternative)

Die Properties können auch als URL-Parameter gesetzt werden:

```
?mode=viewer&readonly=true&controls=false&coreFields=false&specialFields=true
```

| URL-Parameter | Entspricht Property |
|---------------|---------------------|
| `mode=viewer` | `viewerMode=true` |
| `readonly=true` | `readonly=true` |
| `ui=compact` | `compactMode=true` |
| `controls=false` | `controls=false` |
| `coreFields=false` | `showCoreFields=false` |
| `specialFields=false` | `showSpecialFields=false` |
| `fieldActions=false` | `showFieldActions=false` |
| `autoload=file.json` | Lädt JSON automatisch |

## Quick Start

### 1. Build erstellen

```bash
cd metadata-agent-canvas-oeh
npm run build:prod
```

Die generierten Dateien liegen in `dist/`:
- `runtime.*.js`
- `polyfills.*.js`
- `main.*.js`
- `styles.*.css`

### 2. In HTML einbinden

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meine Seite</title>
    
    <!-- Styles -->
    <link rel="stylesheet" href="https://your-domain.com/metadata-agent/styles.css">
</head>
<body>
    <!-- Die Web Component -->
    <metadata-agent-canvas></metadata-agent-canvas>
    
    <!-- Scripts (Reihenfolge wichtig!) -->
    <script src="https://your-domain.com/metadata-agent/runtime.js"></script>
    <script src="https://your-domain.com/metadata-agent/polyfills.js"></script>
    <script src="https://your-domain.com/metadata-agent/main.js"></script>
</body>
</html>
```

## Konfiguration über URL-Parameter

Die Web Component unterstützt verschiedene Modi über URL-Parameter:

| Parameter | Wert | Beschreibung |
|-----------|------|--------------|
| `mode` | `bookmarklet` | Bookmarklet-Modus (kein API-Key-Feld) |
| `mode` | `plugin` | Browser-Plugin-Modus |
| `mode` | `viewer` | Nur-Lese-Modus |
| `compact` | `true` | Kompakte UI ohne Input-Bereich |
| `theme` | `edu-sharing` | edu-sharing Theme laden |
| `schema` | `event.json` | Spezifisches Schema vorladen |

**Beispiel:**
```html
<metadata-agent-canvas></metadata-agent-canvas>
<script>
    // URL-Parameter setzen bevor die Scripts laden
    history.replaceState(null, '', '?mode=bookmarklet&compact=true');
</script>
```

## Kommunikation mit der Web Component

### Daten senden (postMessage)

```javascript
// Text und URL an die Komponente senden
window.postMessage({
    type: 'SET_PAGE_DATA',
    text: 'Workshop: KI in der Bildung, 15. März 2025, Berlin',
    url: 'https://example.com/workshop',
    mode: 'bookmarklet'
}, '*');
```

### Extrahierte Metadaten empfangen

```javascript
window.addEventListener('message', (event) => {
    if (event.data.type === 'METADATA_EXTRACTED') {
        console.log('Metadaten:', event.data.metadata);
    }
    
    if (event.data.type === 'METADATA_SUBMITTED') {
        console.log('Erfolgreich gespeichert:', event.data.nodeId);
    }
});
```

## Styling anpassen

Die Web Component verwendet CSS Custom Properties für Theming:

```css
metadata-agent-canvas {
    /* Container-Größe */
    display: block;
    width: 500px;
    height: 100vh;
    
    /* Material Design Custom Properties können überschrieben werden */
    --mdc-theme-primary: #1976d2;
}
```

## Deployment-Optionen

### Option 1: Netlify/Vercel

1. Repository mit Netlify/Vercel verbinden
2. Build-Command: `npm run build:prod`
3. Publish Directory: `dist`

Die Dateien sind dann unter `https://your-app.netlify.app/` verfügbar.

### Option 2: Statisches Hosting

Die `dist/`-Dateien auf jeden Webserver kopieren:
- nginx
- Apache
- GitHub Pages
- S3 + CloudFront

### Option 3: CDN

Für Produktion empfohlen:

```html
<!-- Von eigenem CDN -->
<script src="https://cdn.your-domain.com/metadata-agent/v1.0.0/main.js"></script>
```

## Vollständiges Beispiel

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Metadata Agent Integration</title>
    <link rel="stylesheet" href="./dist/styles.css">
    <style>
        body {
            margin: 0;
            display: flex;
            height: 100vh;
        }
        
        .main-content {
            flex: 1;
            padding: 20px;
            background: #f5f5f5;
        }
        
        .sidebar {
            width: 500px;
            border-left: 1px solid #ddd;
        }
        
        metadata-agent-canvas {
            display: block;
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <div class="main-content">
        <h1>Meine Anwendung</h1>
        <button id="extract-btn">Metadaten extrahieren</button>
    </div>
    
    <div class="sidebar">
        <metadata-agent-canvas></metadata-agent-canvas>
    </div>
    
    <!-- Scripts -->
    <script src="./dist/runtime.js"></script>
    <script src="./dist/polyfills.js"></script>
    <script src="./dist/main.js"></script>
    
    <script>
        document.getElementById('extract-btn').addEventListener('click', () => {
            window.postMessage({
                type: 'SET_PAGE_DATA',
                text: 'Hier steht der zu analysierende Text...',
                url: window.location.href
            }, '*');
        });
    </script>
</body>
</html>
```

## Unterschied zu iframe-Einbindung

| Feature | Web Component | iframe |
|---------|--------------|--------|
| DOM-Integration | Direkt | Isoliert |
| CSS-Anpassung | Möglich | Nur über postMessage |
| Performance | Besser | Overhead |
| Kommunikation | Events + postMessage | Nur postMessage |
| Bundle-Größe | ~200 KB gzipped | ~200 KB gzipped |

## Troubleshooting

### "metadata-agent-canvas is not defined"

Scripts nicht in der richtigen Reihenfolge geladen. Runtime → Polyfills → Main.

### Styles fehlen

`styles.css` muss im `<head>` eingebunden sein.

### CORS-Fehler

Beim Laden von einem anderen Origin: Server muss `Access-Control-Allow-Origin` Header setzen.

### Assets nicht gefunden

Die Web Component lädt Assets (i18n, Schemas) relativ zum Script-Pfad. 
Stelle sicher, dass `assets/` im selben Verzeichnis liegt wie die JS-Dateien.
