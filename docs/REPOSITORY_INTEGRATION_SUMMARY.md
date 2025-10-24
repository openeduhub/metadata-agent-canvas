# Repository Integration - Implementation Summary

## ✅ Was wurde implementiert

### 1. Lokaler Proxy (`local-universal-proxy.js`)
Vollständige Implementierung für lokale Entwicklung:

#### createNode - Nur 5 essentielle Felder
```javascript
const essentialFields = [
  'cclom:title',                  // Titel
  'cclom:general_description',    // Beschreibung
  'cclom:general_keyword',        // Keywords (Array)
  'ccm:wwwurl',                   // URL
  'cclom:general_language'        // Sprache (z.B. "de")
];
```

#### setMetadata - Whitelist mit Transformationen
```javascript
const supportedFields = [
  // Basis
  'cclom:title',
  'cclom:general_description',
  'cclom:general_keyword',
  'ccm:wwwurl',
  'cclom:general_language',
  
  // Pädagogisch (URI-Felder)
  'ccm:taxonid',                         // Fach → URI
  'ccm:educationalcontext',              // Bildungsstufe → URI
  'ccm:educationalintendedenduserrole',  // Zielgruppe → URI
  
  // Lizenz (Transformation)
  'ccm:commonlicense_key',               // CC_BY_SA
  'ccm:commonlicense_cc_version',        // 4.0
  'ccm:custom_license'                   // (wird transformiert)
];
```

#### Transformations-Logik

**Lizenz:**
```javascript
// Input: {label: "CC BY-SA"} oder URL
// Output: ["CC_BY_SA"] + ["4.0"]

"CC BY" → "CC_BY"
"CC BY-SA" → "CC_BY_SA"
"CC BY-NC-ND" → "CC_BY_NC_ND"
```

**URI-Felder (Fach, Bildungsstufe, Zielgruppe):**
```javascript
// Input: {label: "Mathematik", uri: "http://..."}
// Output: ["http://w3id.org/openeduhub/vocabs/discipline/080"]

// Repository mapped automatisch zu *_display Feldern!
```

**Keywords:**
```javascript
// Input: ["Keyword1", "Keyword2", "Keyword3"]
// Output: ["Keyword1", "Keyword2", "Keyword3"]  (KEINE Transformation)
```

**Normalisierung:**
- Alle Werte → Arrays (auch einzelne Strings)
- Objekte → URIs extrahieren (außer bei Text-Feldern)
- Leere Werte filtern

---

### 2. Netlify Function (`netlify/functions/repository-proxy.js`)

**✅ Vollständig portiert** - Alle Transformationen aus lokalem Proxy

#### Änderungen:
```javascript
// Vorher: Sendet alle Metadaten ungefiltert
// Jetzt: Filtering + Transformation wie lokaler Proxy

createNode(metadata) {
  // Filter auf 5 essentielle Felder
  // Normalisierung zu Arrays
}

setMetadata(nodeId, metadata) {
  // Whitelist (8 Felder)
  // Lizenz-Transformation
  // URI-Extraktion
  // Normalisierung
  // Fallback: Version 4.0 wenn leer
}

setCollections(nodeId, collectionIds) {
  // URL-Extraktion (UUID am Ende)
}
```

---

### 3. Bookmarklet (`src/assets/canvas-integration.js`)

**✅ Erweitert** - Strukturierte Datenübergabe

#### Vorher:
```javascript
postMessage({
  type: 'SET_TEXT',
  text: 'Titel: ...\nURL: ...'  // Alles als Text
});
```

#### Jetzt:
```javascript
postMessage({
  type: 'SET_PAGE_DATA',
  text: 'Titel: ...\nURL: ...',  // Formatiert für Textarea
  url: 'https://example.com',     // ← Separat!
  pageTitle: 'Example Page',
  mode: 'bookmarklet'
});
```

**Vorteil:** URL wird erkannt und kann für Dublettenprüfung/Metadata genutzt werden

---

### 4. Canvas Webkomponente

**✅ Erweitert** - Neuer postMessage Handler

#### Neue Features:
```typescript
// Handler für strukturierte Daten (Bookmarklet)
if (event.data.type === 'SET_PAGE_DATA') {
  this.userText = event.data.text;
  
  // URL in SessionStorage für späteren Zugriff
  sessionStorage.setItem('canvas_page_url', event.data.url);
  
  // Bestätigung zurück
  postMessage({ type: 'PAGE_DATA_RECEIVED', success: true });
}

// Legacy Handler (backward compatible)
if (event.data.type === 'SET_TEXT') {
  this.userText = event.data.text;
}
```

---

## 🧪 Getestete Szenarien

### ✅ Lokaler Betrieb (localhost:3000 Proxy)
```bash
# Terminal 1: Proxy
cd webkomponente-canvas
npm run proxy

# Terminal 2: Frontend
npm start
```

**Test:**
1. URL eingeben: https://stadt.weimar.de/...
2. Generate → LLM extrahiert Metadaten
3. Fach, Bildungsstufe, Lizenz auswählen
4. "Vorschlag einreichen"
5. ✅ **Funktioniert!**
   - Titel, Beschreibung, Keywords, URL, Sprache ✓
   - Fach (URI), Bildungsstufe (URI), Zielgruppe (URI) ✓
   - Lizenz (CC_BY_SA + 4.0) ✓

### ⏳ Netlify Deployment (noch zu testen)
```bash
npm run build
netlify deploy --prod
```

**Nach Deploy testen:**
1. Standalone: `https://your-site.netlify.app/`
2. Bookmarklet: Mit strukturierten Daten
3. Browser-Plugin: Integration mit Canvas

---

## 📋 Deployment-Schritte

### 1. Environment Variables setzen
```bash
# LLM
netlify env:set OPENAI_API_KEY "sk-proj-..." --secret
netlify env:set B_API_KEY "uuid-key" --secret
netlify env:set LLM_PROVIDER "b-api-openai"

# Geocoding (optional)
netlify env:set PHOTON_API_URL "https://photon.komoot.io"
```

### 2. Frontend Rebuild
```bash
cd webkomponente-canvas
npm run build
```

**Wichtig:** Canvas muss neu gebaut werden, damit:
- Neuer postMessage Handler (`SET_PAGE_DATA`) verfügbar ist
- Bookmarklet-Integration funktioniert

### 3. Deploy
```bash
netlify deploy --prod
```

### 4. Bookmarklet aktualisieren
```javascript
// Neue canvasUrl im Bookmarklet:
javascript:(function(){
  const script=document.createElement('script');
  script.src='https://YOUR-SITE.netlify.app/assets/canvas-integration.js';
  script.onload=()=>{
    MetadataCanvas.init({canvasUrl:'https://YOUR-SITE.netlify.app'});
    MetadataCanvas.extractFromPage();
  };
  document.head.appendChild(script);
})();
```

---

## 🐛 Bekannte Einschränkungen

### Event-Felder
**Status:** Gefiltert (werden nicht gesendet)

```javascript
// Diese Felder werden übersprungen:
'oeh:eventType'
'schema:startDate'
'schema:endDate'
'schema:location'
// ... alle schema:* Felder
```

**Grund:** Repository API unterstützt sie nicht (HTTP 400/500 Fehler)

**Lösung:** Später, wenn Repository Event-Support hat

---

### Author/Publisher Felder
**Status:** Gefiltert

```javascript
// Nicht in Whitelist:
'ccm:author_freetext'
'ccm:oeh_publisher_combined'
```

**Grund:** Browser-Plugin sendet sie auch nicht

**Lösung:** Kann später hinzugefügt werden, wenn getestet

---

## 🔄 Browser-Plugin Integration

### Aktueller Workflow (ohne Canvas)
```
Plugin → generic-crawler API → embed/mds Iframe → Plugin submit
```

### Neuer Workflow (mit Canvas, optional)
```
Plugin → Canvas Iframe → LLM Extraktion → Plugin submit
```

**Noch zu implementieren:**
- Plugin sendet extrahierte Daten via postMessage
- Canvas extrahiert mit LLM
- Canvas sendet JSON zurück an Plugin
- **Plugin macht Repository-Submit** (nicht Canvas!)

**Wichtig:** 
- Canvas ist nur Extraktions-Tool für Plugin
- Repository-Submission bleibt im Plugin
- Plugin nutzt eigene credentials (nicht WLO-Upload Guest)

---

## 📊 Datenfluss-Übersicht

### Standalone/Bookmarklet
```
User Input (URL/Text)
  ↓
LLM Extraction (Netlify openai-proxy)
  ↓
Canvas UI (Feldbearbeitung)
  ↓
Submit Button
  ↓
repository-proxy.js (Netlify Function)
  ├─ createNode (5 Felder)
  ├─ setMetadata (8 Felder, transformiert)
  ├─ setCollections (optional)
  └─ startWorkflow
  ↓
Repository API (staging.openeduhub.net)
  ↓
Guest Inbox (WLO-Upload user)
```

### Browser-Plugin (zukünftig)
```
Plugin extrahiert Webseite
  ↓
postMessage: PLUGIN_DATA → Canvas
  ↓
LLM Extraction in Canvas
  ↓
postMessage: CANVAS_METADATA_READY → Plugin
  ↓
Plugin submittet zu Repository
  (eigene credentials, eigener Code)
```

---

## ✅ Checkliste für Production

- [x] Lokaler Proxy funktioniert
- [x] Netlify Function aktualisiert
- [x] Bookmarklet erweitert
- [x] Canvas postMessage Handler
- [x] Lizenz-Transformation (CC_BY_SA)
- [x] URI-Extraktion (Fach, Bildungsstufe)
- [x] Normalisierung (Arrays)
- [x] Dokumentation

**Nächste Schritte:**
- [ ] Frontend Rebuild
- [ ] Netlify Deploy
- [ ] Bookmarklet testen
- [ ] Browser-Plugin Integration
- [ ] Event-Felder Support (später)

---

## 📝 Commit Message

```
feat: Repository Integration für Netlify Deployment

- ✅ Netlify Function: repository-proxy.js mit kompletter Transformation
- ✅ createNode: Filter auf 5 essentielle Felder
- ✅ setMetadata: Lizenz-Transformation, URI-Extraktion, Normalisierung
- ✅ Bookmarklet: Strukturierte Datenübergabe (URL separat)
- ✅ Canvas: postMessage Handler für SET_PAGE_DATA
- 📚 Dokumentation: NETLIFY_INTEGRATION.md

Getestet lokal, bereit für Netlify Deploy.
```
