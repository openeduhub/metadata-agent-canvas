# Netlify Integration - Repository Submission

## ✅ Implementierungsstatus

### Lokaler Proxy (lokal-universal-proxy.js)
- ✅ Vollständig implementiert mit allen Transformationen
- ✅ Filtering (nur essentielle Felder für createNode)
- ✅ Lizenz-Transformation (CC BY → CC_BY)
- ✅ URI-Extraktion (Objekte → URIs für Fach, Bildungsstufe, Zielgruppe)
- ✅ Normalisierung (alle Werte als Arrays)

### Netlify Function (repository-proxy.js)
- ✅ **Portiert** - Alle Transformationen aus lokalem Proxy übertragen
- ✅ `createNode`: Nur 5 essentielle Felder
- ✅ `setMetadata`: Komplette Transformation & Normalisierung
- ✅ `setCollections`: URL-Extraktion
- ✅ `checkDuplicate`: Wie bisher
- ✅ `startWorkflow`: Wie bisher

### Bookmarklet Integration
- ✅ **Erweitert** - Sendet jetzt strukturierte Daten
- ✅ URL wird separat übergeben (nicht nur im Text)
- ✅ Seiteninhalt wird extrahiert
- ✅ postMessage: `SET_PAGE_DATA` mit `url`, `text`, `pageTitle`

### Canvas Webkomponente
- ✅ **Erweitert** - Empfängt strukturierte Daten
- ✅ Handler für `SET_PAGE_DATA` (Bookmarklet)
- ✅ Handler für `SET_TEXT` (Legacy - backward compatible)
- ✅ URL wird in SessionStorage gespeichert

---

## 🔄 Integration-Modi

### 1. Standalone (Direktzugriff)
**URL:** `https://your-netlify-site.netlify.app/`

**Workflow:**
```
User gibt Text/URL ein 
  → LLM-Extraktion via Netlify Functions
  → Canvas zeigt Felder
  → Submit → Netlify Function: repository-proxy.js
  → Repository API (5 Schritte)
```

**Repository-Calls:**
- `createNode` (5 Felder)
- `setMetadata` (alle weiteren Felder)
- `setCollections` (optional)
- `startWorkflow`

---

### 2. Bookmarklet (Overlay auf Webseiten)
**Integration:** JavaScript-Bookmarklet lädt Canvas als Overlay

**Workflow:**
```
User klickt Bookmarklet 
  → canvas-integration.js extrahiert Seite
  → postMessage: SET_PAGE_DATA { url, text, pageTitle }
  → Canvas empfängt & setzt URL in SessionStorage
  → LLM-Extraktion mit URL-Kontext
  → Submit → repository-proxy.js
  → Repository API
```

**Datenfluss:**
```javascript
// Bookmarklet sendet:
{
  type: 'SET_PAGE_DATA',
  text: 'Titel: ...\nURL: ...\nInhalt: ...',
  url: 'https://example.com/page',
  pageTitle: 'Example Page',
  mode: 'bookmarklet'
}

// Canvas empfängt & setzt:
sessionStorage.setItem('canvas_page_url', url);
```

---

### 3. Browser-Plugin Integration
**Plugin:** metadata-browser-plugin (Manifest V3 Chrome Extension)

**Workflow A - Mit generischem Crawler (aktuell):**
```
User öffnet Plugin auf Webseite
  → Plugin: Dublettenprüfung
  → API Call: generic-crawler-ui
  → Plugin öffnet Iframe mit embed/mds Formular
  → User bearbeitet
  → Plugin: Repository API Calls (background.js)
    - createNode
    - setMetadata
    - setCollections
    - startWorkflow
```

**Workflow B - Mit Canvas Webkomponente (neu/optional):**
```
User öffnet Plugin auf Webseite
  → Plugin extrahiert Seite (content-extractor.js)
  → Plugin öffnet Canvas Iframe
  → postMessage: JSON-Daten an Canvas
    {
      type: 'PLUGIN_DATA',
      url: window.location.href,
      html: document.documentElement.outerHTML,
      metadata: { ... }
    }
  → Canvas: LLM-Extraktion
  → Canvas: postMessage zurück an Plugin: CANVAS_METADATA_READY
  → Plugin: Repository API Calls (wie Workflow A)
```

**Wichtig:** 
- Plugin macht Repository-Submission (nicht Canvas!)
- Canvas liefert nur extrahierte JSON-Metadaten
- Plugin nutzt eigene credentials (nicht WLO-Upload Guest)

---

## 📡 postMessage Protokoll

### Bookmarklet → Canvas
```javascript
{
  type: 'SET_PAGE_DATA',      // Neuer strukturierter Typ
  text: string,               // Formatierter Text für Textarea
  url: string,                // Original-URL der Seite
  pageTitle: string,          // Seitentitel
  mode: 'bookmarklet'         // Integration-Modus
}

// Legacy (backward compatible):
{
  type: 'SET_TEXT',
  text: string
}
```

### Canvas → Bookmarklet (Bestätigung)
```javascript
{
  type: 'PAGE_DATA_RECEIVED',
  success: true
}
```

### Browser-Plugin → Canvas
```javascript
{
  type: 'PLUGIN_DATA',
  url: string,
  html: string,
  metadata: { /* extracted data */ },
  mode: 'browser-extension'
}
```

### Canvas → Browser-Plugin
```javascript
{
  type: 'CANVAS_METADATA_READY',
  metadata: { /* complete metadata */ },
  mode: 'browser-extension'
}
```

---

## 🔐 Authentifizierung

### Standalone & Bookmarklet
- **Credentials:** WLO-Upload Guest (hardcoded in repository-proxy.js)
- **Username:** `WLO-Upload`
- **Password:** `wlo#upload!20`
- **Collection:** `21144164-30c0-4c01-ae16-264452197063` (Guest Inbox)

### Browser-Plugin
- **Credentials:** User kann sich einloggen ODER Guest nutzen
- **User-Login:** Eigene credentials aus chrome.storage
- **Guest-Modus:** Gleiche credentials wie oben
- **Collection:** User-spezifisch oder Guest Inbox

---

## 🏗️ Deployment-Checkliste

### Netlify Environment Variables
```bash
# LLM API
netlify env:set OPENAI_API_KEY "sk-proj-..." --secret
netlify env:set B_API_KEY "uuid-key" --secret
netlify env:set LLM_PROVIDER "b-api-openai"

# Geocoding (optional)
netlify env:set PHOTON_API_URL "https://photon.komoot.io"
```

### Build & Deploy
```bash
cd webkomponente-canvas
npm run build
netlify deploy --prod
```

### Testen
1. **Standalone:** `https://your-site.netlify.app/`
2. **Bookmarklet:** Füge JavaScript-Bookmarklet hinzu
3. **Browser-Plugin:** Installiere Plugin, konfiguriere Canvas-URL

---

## 🧪 Test-Szenarien

### Scenario 1: Standalone Submission
```
1. Öffne https://your-site.netlify.app/
2. Gebe URL ein: https://example.com/event
3. Klicke "Generate"
4. Prüfe extrahierte Felder
5. Klicke "Vorschlag einreichen"
6. Prüfe Repository: Titel, Beschreibung, Keywords, URL, Fach, Bildungsstufe, Lizenz
```

### Scenario 2: Bookmarklet Overlay
```
1. Gehe zu: https://example.com/event
2. Klicke Bookmarklet
3. Canvas öffnet als Overlay (rechts)
4. URL wird automatisch erkannt
5. Klicke "Generate" (mit vorausgefüllter URL)
6. Submit → Repository
```

### Scenario 3: Browser-Plugin
```
1. Gehe zu: https://example.com/event
2. Öffne Plugin-Sidebar
3. Plugin extrahiert Seite
4. Plugin ruft Canvas auf (Option A oder B)
5. User bearbeitet Daten
6. Plugin submitted zum Repository
```

---

## 🐛 Debugging

### Netlify Function Logs
```bash
netlify functions:log repository-proxy
```

### Browser Console
- Bookmarklet: `console.log` in canvas-integration.js
- Canvas: `console.log` in canvas-view.component.ts
- Plugin: Chrome DevTools → Extension Background Page

### Repository API Errors
- HTTP 400: Falsche Datenstruktur (Prüfe Arrays!)
- HTTP 500: Repository-interner Fehler
- HTTP 401: Auth-Problem (Credentials prüfen)

---

## 📝 Nächste Schritte

- [ ] Rebuild Frontend mit neuen postMessage Handlern
- [ ] Test Bookmarklet mit strukturierten Daten
- [ ] Browser-Plugin erweitern für Canvas-Integration
- [ ] Event-Felder Support (aktuell gefiltert)
- [ ] Author/Publisher Support (aktuell gefiltert)

---

## 🔗 Dateien

### Netlify Functions
- `netlify/functions/repository-proxy.js` - Repository API Proxy
- `netlify/functions/openai-proxy.js` - LLM API Proxy
- `netlify/functions/photon.js` - Geocoding Proxy

### Integration
- `src/assets/canvas-integration.js` - Bookmarklet Library
- `src/app/components/canvas-view/canvas-view.component.ts` - postMessage Handler
- `src/app/services/integration-mode.service.ts` - Mode Detection

### Lokaler Proxy (Referenz)
- `local-universal-proxy.js` - Vollständige Implementierung (Vorlage für Netlify)
