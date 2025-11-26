# Compact UI Mode 🎨

## Übersicht

Der **Compact UI Mode** bietet eine minimale, fokussierte Oberfläche für Bookmarklet- und Browser-Plugin-Integrationen. Die Extraktionsfunktionalität bleibt vollständig erhalten, aber die UI wird auf das Wesentliche reduziert.

## Features

### ✅ Was wird gezeigt:
- **Floating Controls** (Links): Content-Type **Split Button** (Display + Dropdown kombiniert)
- **Floating Controls** (Rechts): JSON-Loader, Save, Upload, Language Switcher, Close
- **Canvas**: Alle Metadatenfelder mit Inline-Editing
- **Progress Bar**: Im Normal Mode in der Status Bar integriert

### ❌ Was wird versteckt:
- **Texteingabefeld**: Nicht sichtbar (aber funktional im Hintergrund)
- **Extract-Button**: Extraktion startet automatisch

## URL-Parameter

### Grundformat:
```
?ui=compact
```

### Kombinationen mit Integration Modes:

**1. Bookmarklet + Compact UI:**
```
?ui=compact
```
- Bookmarklet-Logik zieht automatisch Daten von der Seite
- Startet Extraktion automatisch
- Zeigt nur Canvas + Floating Controls

**2. Browser-Plugin + Compact UI:**
```
?ui=compact
```
- Plugin sendet Daten via `postMessage`
- Extraktion startet automatisch bei Datenempfang
- Zeigt nur Canvas + Floating Controls

### Optionale Kombinationen:

**Mit Language Preselection:**
```
?ui=compact&lang=en
```

**Mit Schema Preselection:**
```
?ui=compact&schema=event.json
```

**Mit Read-Only (für reine Ansicht):**
```
?ui=compact&readonly=true
```

## Verwendung

### Bookmarklet-Szenario

**Normal (mit Input-Feld):**
```javascript
// Bisheriger Bookmarklet-Code
window.open('https://metadata-agent-canvas.staging.openeduhub.net/');
```

**Compact UI (ohne Input-Feld):**
```javascript
// Neuer Compact UI Mode
window.open('https://metadata-agent-canvas.staging.openeduhub.net/?ui=compact');
```

**Workflow:**
1. User klickt Bookmarklet auf einer Webseite
2. Canvas öffnet sich als Overlay mit Compact UI
3. Daten werden automatisch von der Seite extrahiert
4. Extraktion startet automatisch
5. User sieht nur Canvas + Floating Controls
6. User kann Felder bearbeiten und speichern

### Browser-Plugin-Szenario

**Normal (mit Input-Feld):**
```javascript
// Bisheriger Plugin-Code
iframe.src = 'https://metadata-agent-canvas.staging.openeduhub.net/';
// Send data via postMessage
```

**Compact UI (ohne Input-Feld):**
```javascript
// Neuer Compact UI Mode
iframe.src = 'https://metadata-agent-canvas.staging.openeduhub.net/?ui=compact';
// Send data via postMessage
```

**Workflow:**
1. Plugin öffnet Canvas in iframe/popup mit Compact UI
2. Plugin sendet Metadaten via `postMessage`
3. Canvas empfängt Daten und startet Extraktion automatisch
4. User sieht nur Canvas + Floating Controls
5. User kann Felder bearbeiten
6. Plugin empfängt fertige Metadaten via `postMessage`

## Technische Details

### Auto-Start der Extraktion

**Bookmarklet:**
- Bookmarklet setzt `window.METADATA_AGENT_DATA` wie bisher
- Canvas erkennt Daten und startet automatisch

**Browser-Plugin:**
- Plugin sendet `{ type: 'METADATA_INPUT', data: {...} }` wie bisher
- Canvas empfängt Daten via `postMessage` und startet automatisch

### Floating Controls Layout

Die Controls sind in zwei Container aufgeteilt:

**Left Container (Content Type Split Button):**
```html
<div class="floating-content-type-split">
  <div class="split-button-container">
    <!-- Left side: Content Type Display -->
    <div class="split-button-main">
      <mat-icon>category</mat-icon>
      <span>{{ getContentTypeLabel() }}</span>
    </div>
    
    <!-- Right side: Dropdown Button -->
    <button mat-button [matMenuTriggerFor]="contentTypeMenuFloating" 
            class="split-button-dropdown">
      <mat-icon>expand_more</mat-icon>
    </button>
  </div>
</div>
```

**Right Container (Action Buttons):**
```html
<div class="floating-action-buttons">
  <app-json-loader></app-json-loader>
  <button mat-icon-button class="save-button">
    <mat-icon>save</mat-icon>
  </button>
  <button mat-icon-button class="upload-button">
    <mat-icon>cloud_upload</mat-icon>
  </button>
  <app-language-switcher></app-language-switcher>
  <button mat-icon-button class="btn-close">
    <mat-icon>close</mat-icon>
  </button>
</div>
```

**Styling:**
```css
.floating-controls-wrapper.active {
  position: fixed;
  bottom: 24px; /* Bottom center positioning */
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 24px; /* Spacing between left and right containers */
  max-width: 95vw;
}

/* Split Button Container - White pill matching action buttons */
.floating-content-type-split .split-button-container {
  background: #ffffff;
  border-radius: 28px; /* M3 pill shape */
  height: 56px; /* Same height as action buttons */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15);
}

/* Split Button: Left side (display) */
.split-button-main {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  color: #1c1b1f; /* Dark text on white */
  font-size: 14px;
  font-weight: 500;
}

/* Split Button: Right side (dropdown) */
.split-button-dropdown {
  width: 48px;
  height: 100%;
  background: transparent;
  border-radius: 0 28px 28px 0; /* Rounded only on right */
}

/* Vertical divider between display and dropdown */
.split-button-main::after {
  content: '';
  width: 1px;
  background: rgba(0, 0, 0, 0.12);
}

.floating-action-buttons {
  background: #ffffff;
  padding: 4px 8px;
  border-radius: 28px;
  height: 56px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15);
}
```

## Vergleich der Modi

### Normal Mode (Standalone/Bookmarklet/Plugin)
```
┌───────────────────────────────┐
│ [🔽] [💾] [☁️] [🌐] [✖️]     │ Controls (Standard Position)
├───────────────────────────────┤
│                               │
│ Texteingabefeld               │ ← Sichtbar
│ [Extract] [Reset]             │
│                               │
├───────────────────────────────┤
│ Content Type: Event [Ändern▼]│
├───────────────────────────────┤
│ 📋 Beschreibung               │
│ ✓ Titel                       │
│ ✓ Beschreibung                │
│ ...                           │
└───────────────────────────────┘
```

### Compact UI Mode
```
┌──────────────────────────────────────────────────┐
│ 📋 Beschreibung                                  │
│ ✓ Titel                                          │
│ ✓ Beschreibung                                   │
│ ...                                              │
├──────────────────────────────────────────────────┤
│  [📁 Event | ▼]  |  [🔽] [💾] [☁️] [🌐] [✖️] │ ← Floating Bottom (Split Button)
│     ↑ Split Button    ↑ Action Buttons           │
└──────────────────────────────────────────────────┘
```

### Viewer Mode (Read-Only)
```
┌─────────────────────────────┐
│ [🔽] [💾] [☁️] [🌐]        │ ← Floating (optional)
├─────────────────────────────┤
│ 📋 Beschreibung             │ ← Kein Content-Type Selector
│ ✓ Titel                     │
│ ✓ Beschreibung              │
│ ...                         │
└─────────────────────────────┘
```

## Unterschiede zu Viewer Mode

| Feature | Viewer Mode | Compact UI Mode |
|---------|-------------|-----------------|
| **Zweck** | JSON-Dateien anzeigen | Extraktion mit minimaler UI |
| **Input-Feld** | ❌ Versteckt | ❌ Versteckt |
| **Content-Type** | ❌ Versteckt | ✅ Split Button (Display + Dropdown) |
| **Extraktion** | ❌ Nicht verfügbar | ✅ Automatisch gestartet |
| **Edit-Modus** | Optional (readonly) | ✅ Immer editierbar |
| **Floating Controls** | Optional | ✅ Immer aktiv (Links + Rechts) |
| **Controls Layout** | Einfach | ✅ Zweigeteilt (Content-Type + Actions) |
| **Use Case** | Metadaten ansehen | Metadaten extrahieren |

## Migration Guide

### Bestehende Bookmarklets aktualisieren:

**Alt:**
```javascript
(function() {
  window.open('https://metadata-agent-canvas.staging.openeduhub.net/');
})();
```

**Neu (mit Compact UI):**
```javascript
(function() {
  window.open('https://metadata-agent-canvas.staging.openeduhub.net/?ui=compact');
})();
```

### Bestehende Browser-Plugins aktualisieren:

**Alt:**
```typescript
const iframe = document.createElement('iframe');
iframe.src = 'https://metadata-agent-canvas.staging.openeduhub.net/';
```

**Neu (mit Compact UI):**
```typescript
const iframe = document.createElement('iframe');
iframe.src = 'https://metadata-agent-canvas.staging.openeduhub.net/?ui=compact';
```

## Vorteile

### ✅ Für Entwickler:
- Einfacher URL-Parameter (`?ui=compact`)
- Keine Code-Änderungen in Bookmarklet/Plugin-Logik nötig
- Bestehende `postMessage`-API bleibt unverändert

### ✅ Für Benutzer:
- Weniger visuelles "Rauschen"
- Fokus auf die Metadaten
- Schnellerer Zugriff auf Felder
- Keine verwirrenden leeren Input-Felder

### ✅ Für UX:
- Moderne Floating Controls
- Content-Type bleibt änderbar
- Maximale Canvas-Fläche
- Konsistentes Design mit Viewer Mode

## Fazit

Der **Compact UI Mode** ist die perfekte Lösung für Bookmarklet- und Browser-Plugin-Integrationen, die eine saubere, fokussierte Oberfläche benötigen, ohne die volle Extraktionsfunktionalität zu verlieren.
