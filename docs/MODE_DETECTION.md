# Automatische Modus-Erkennung

## ✅ Wie Canvas den Betriebsmodus erkennt

Canvas (`IntegrationModeService`) erkennt **automatisch** in welchem Modus es läuft:

### Erkennungs-Prioritäten:

```typescript
1. URL-Parameter (?mode=browser-extension oder ?mode=bookmarklet)
   ↓ Falls nicht vorhanden ↓
2. Iframe-Check (window !== window.parent)
   ↓ Falls nicht im iframe ↓
3. Hostname-Check (localhost vs. deployed)
```

---

## 🔍 Modi und ihre Erkennung

### 1. **Standalone Modus**

#### Wann?
- Direkter Zugriff auf Canvas-URL
- **NICHT** im iframe
- Keine URL-Parameter

#### Erkennung:
```javascript
// NICHT im iframe
window === window.parent

// URL: https://your-site.netlify.app/ (oder http://localhost:4200)
```

#### Verhalten:
- User gibt URL/Text manuell ein
- Submit → **Netlify Functions** (`/.netlify/functions/repository-proxy`)
- Guest credentials (WLO-Upload)
- Keine postMessage-Kommunikation

#### Console Output:
```
🌐 Mode: Standalone (deployed, direct access)
// oder
🖥️ Mode: Standalone (local development)
```

---

### 2. **Bookmarklet/Overlay Modus**

#### Wann?
- Canvas läuft in **iframe** (von Bookmarklet Script geöffnet)
- Deployed auf Netlify
- Bekommt postMessage: `SET_PAGE_DATA`

#### Erkennung:
```javascript
// Im iframe
window !== window.parent

// Deployed
!window.location.hostname.includes('localhost')

// postMessage mit mode
event.data.mode === 'bookmarklet'
```

#### Verhalten:
- Bookmarklet extrahiert Seite → sendet via postMessage
- Canvas empfängt URL, Text, Metadata
- Submit → **Netlify Functions** (wie Standalone)
- Guest credentials
- postMessage: `CANVAS_CLOSE` zum Schließen

#### Console Output:
```
🌐 Mode: Bookmarklet (iframe, deployed)
📨 Received page data via postMessage:
  - URL: https://example.com
  - Title: Example Page
  - Mode: bookmarklet
```

#### postMessage Flow:
```
Bookmarklet → Canvas:
{
  type: 'SET_PAGE_DATA',
  text: '...',
  url: '...',
  pageTitle: '...',
  mode: 'bookmarklet'
}

Canvas → Bookmarklet:
{
  type: 'PAGE_DATA_RECEIVED',
  success: true
}
```

---

### 3. **Browser-Plugin Modus**

#### Wann?
- Canvas läuft in **iframe** (von Browser-Plugin geöffnet)
- Lokal ODER deployed
- Bekommt postMessage: `PLUGIN_PAGE_DATA`

#### Erkennung:
```javascript
// Im iframe
window !== window.parent

// postMessage mit mode
event.data.mode === 'browser-extension'

// Oder: Lokal im iframe
window.location.hostname.includes('localhost') && window !== window.parent
```

#### Verhalten:
- Plugin extrahiert Seite → sendet via postMessage
- Canvas empfängt URL, HTML, Text, Metadata
- User bearbeitet Felder
- Submit → **postMessage an Plugin** (NICHT Netlify Functions!)
- Plugin schreibt ins Repository
- User ODER Guest credentials (abhängig von Plugin-Login)

#### Console Output:
```
🔌 Mode: Browser Extension (iframe, local)
📨 Received page data from Browser Plugin:
  - URL: https://example.com
  - Title: Example Page
  - Mode: browser-extension
🔄 Mode updated to: browser-extension
```

#### postMessage Flow:
```
Plugin → Canvas:
{
  type: 'PLUGIN_PAGE_DATA',
  url: '...',
  html: '...',
  text: '...',
  title: '...',
  metadata: {...},
  mode: 'browser-extension'
}

Canvas → Plugin:
{
  type: 'PLUGIN_DATA_RECEIVED',
  success: true
}

... User bearbeitet & klickt Submit ...

Canvas → Plugin:
{
  type: 'CANVAS_METADATA_READY',
  metadata: {...},
  mode: 'browser-extension'
}

Plugin → Repository API
```

---

## 🎯 Submit-Verhalten pro Modus

### Standalone
```typescript
if (mode === 'standalone') {
  // Submit zu Netlify Functions
  await fetch('/.netlify/functions/repository-proxy', {
    method: 'POST',
    body: JSON.stringify({
      action: 'createNode',
      data: { metadata }
    })
  });
}
```

### Bookmarklet
```typescript
if (mode === 'bookmarklet') {
  // Submit zu Netlify Functions (gleich wie Standalone)
  await fetch('/.netlify/functions/repository-proxy', {
    method: 'POST',
    body: JSON.stringify({
      action: 'createNode',
      data: { metadata }
    })
  });
  
  // Dann schließen
  this.integrationMode.requestClose();
}
```

### Browser-Extension
```typescript
if (mode === 'browser-extension') {
  // postMessage an Plugin (KEIN API Call!)
  this.integrationMode.sendMetadataToParent(metadata);
  
  // Plugin übernimmt Repository-Submission
  // Canvas schließt sich
}
```

---

## 🔄 Mode-Update Flow

### Initial Detection (beim Laden)
```typescript
constructor() {
  this.detectMode();
  // Setzt initial mode basierend auf URL + iframe
}
```

### Dynamic Update (via postMessage)
```typescript
window.addEventListener('message', (event) => {
  if (event.data.mode) {
    this.integrationMode.setMode(event.data.mode);
  }
});
```

---

## 🧪 Testing verschiedener Modi

### 1. Standalone Local
```bash
npm start
# → http://localhost:4200
# Console: "🖥️ Mode: Standalone (local development)"
```

### 2. Standalone Deployed
```bash
npm run build
netlify deploy --prod
# → https://your-site.netlify.app
# Console: "🌐 Mode: Standalone (deployed, direct access)"
```

### 3. Bookmarklet
```javascript
// Bookmarklet Script lädt Canvas als iframe
iframe.src = 'https://your-site.netlify.app';
// Sendet postMessage mit mode: 'bookmarklet'
// Console: "🌐 Mode: Bookmarklet (iframe, deployed)"
```

### 4. Browser-Extension Local
```bash
# Canvas lokal:
npm start  # localhost:4200

# Plugin öffnet Canvas
openCanvas('http://localhost:4200', pageData);
// Console: "🔌 Mode: Browser Extension (iframe, local)"
```

### 5. Browser-Extension Deployed
```bash
# Canvas deployed:
npm run build && netlify deploy --prod

# Plugin Config:
CANVAS_CONFIG.url = 'https://your-site.netlify.app'

# Plugin öffnet Canvas
openCanvas('https://your-site.netlify.app', pageData);
// Console: "🔌 Mode: Browser Extension (iframe, deployed)"
```

---

## 📊 Decision Tree

```
Canvas startet
  ↓
URL hat ?mode=... ?
  ├─ Ja: Nutze diesen Modus ✅
  └─ Nein ↓
       ↓
  Im iframe? (window !== window.parent)
  ├─ Ja ↓
  │    ↓
  │  Deployed?
  │  ├─ Ja: Default Bookmarklet
  │  └─ Nein: Default Browser-Extension
  │    ↓
  │  Warte auf postMessage
  │  ├─ mode='browser-extension' → Update ✅
  │  └─ mode='bookmarklet' → Update ✅
  │
  └─ Nein: Standalone ✅
       ↓
     Deployed?
     ├─ Ja: "Standalone (deployed)"
     └─ Nein: "Standalone (local)"
```

---

## 🎨 UI-Anpassungen pro Modus

### Button Text
```typescript
getSubmitButtonText(): string {
  if (isLoggedIn) return '📤 Veröffentlichen';
  if (isBookmarklet) return '📮 Vorschlag einreichen';
  if (isBrowserExtension) return '💾 An Plugin senden';
  return '💾 JSON herunterladen';
}
```

### Close Button
```typescript
// Nur im iframe-Modus sichtbar
showCloseButton(): boolean {
  return this.integrationMode.isBookmarklet() || 
         this.integrationMode.isBrowserExtension();
}
```

### Mode Indicator (Badge)
```html
<div class="mode-badge">
  {{ integrationMode.getModeDisplayName() }}
</div>
```

---

## 🐛 Debugging

### Console Logs prüfen
```javascript
// Beim Start
"🔌 Mode: Browser Extension (iframe, local)"

// Bei postMessage
"📨 Received page data from Browser Plugin"
"🔄 Mode updated to: browser-extension"

// Bei Submit
"📤 Metadata sent to parent"  // Browser-Extension
// ODER
"📮 Submitting to repository..." // Standalone/Bookmarklet
```

### Mode überprüfen
```javascript
// Chrome DevTools Console
angular.probe(document.querySelector('app-canvas-view'))
  .componentInstance.integrationMode.getMode()

// Expected: 'standalone' | 'browser-extension' | 'bookmarklet'
```

### Force Mode (für Testing)
```javascript
// Temporär in detectMode() ändern:
this.mode = 'browser-extension'; // Force mode
console.log('🧪 FORCED MODE FOR TESTING');
```

---

## ✅ Checkliste Implementation

- [x] IntegrationModeService mit automatischer Detection
- [x] Iframe-Check (window !== window.parent)
- [x] postMessage Mode-Update
- [x] Hostname-basierte Fallback-Logik
- [x] setMode() für dynamisches Update
- [ ] Submit-Logik mode-abhängig implementieren
- [ ] UI Button Text anpassen
- [ ] Close Button nur in iframe-Modi
- [ ] Mode Indicator Badge

---

## 📚 Siehe auch

- `NETLIFY_INTEGRATION.md` - Komplette Integration-Übersicht
- `CANVAS_INTEGRATION.md` - Browser-Plugin spezifisch
- `src/app/services/integration-mode.service.ts` - Implementation
