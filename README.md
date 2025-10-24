# Metadata Agent - Canvas Edition

Angular-basierte Webkomponente für die KI-gestützte Metadaten-Extraktion mit paralleler Verarbeitung und Canvas-basierter UI für Inline-Editing.

**✨ Multi-Mode Integration:** Läuft als Standalone-App, Bookmarklet-Overlay oder integriert im Browser-Plugin!

## 🎯 Features

### Core Features
- ⚡ **Schnell**: Parallele Feld-Extraktion (6-10s statt 40-50s)
- 🎨 **Canvas-UI**: Alle Felder gleichzeitig sichtbar und bearbeitbar mit Baum-Hierarchie für verschachtelte Felder
- 📊 **Live-Updates**: Echtzeit-Streaming während der Extraktion
- ✏️ **Inline-Editing**: Direkte Feldbearbeitung mit Autocomplete
- 🔄 **Automatische Normalisierung**: Datumsformate, URLs, Vokabulare (mit intelligenter LLM-Fallback-Optimierung)
- 🗺️ **Geocoding-Integration**: Automatische Anreicherung mit Geo-Koordinaten beim Export (Photon API)
- 🎓 **Content-Type-Erkennung**: Automatische Schema-Auswahl (Event, Kurs, etc.)
- ✅ **Validierung**: Pflichtfelder, Vokabulare, Datentypen
- 🔒 **Sicher**: API-Key wird nie im Code gespeichert (Production)
- 🔌 **Multi-Provider Support**: OpenAI, B-API OpenAI, B-API AcademicCloud (DeepSeek-R1)

### Integration Modes
- 🌐 **Standalone**: Direkter Zugriff auf deployed URL
- 🔖 **Bookmarklet**: Als Overlay auf beliebigen Webseiten
- 🧩 **Browser-Plugin**: Integriert in WLO Browser Extension
- 🔄 **Auto-Detection**: Erkennt automatisch den Betriebsmodus
- 📤 **Smart Submit**: Mode-abhängige Daten-Submission (Netlify Functions oder postMessage)

---

## ⚡ Schnellstart (TL;DR)

### 1. Repository klonen
```bash
git clone https://github.com/janschachtschabel/metadata-agent-canvas.git
cd metadata-agent-canvas/webkomponente-canvas
```

### 2. Dependencies installieren
```bash
npm install
```

### 3. API-Key & Provider konfigurieren

**NEU: Multi-Provider Support** 🎉

Die App unterstützt jetzt **drei LLM-Provider**:
- **OpenAI** (direkt)
- **B-API OpenAI** (OpenAI-kompatible Modelle via B-API)
- **B-API AcademicCloud** (DeepSeek-R1 via B-API)

**Option A: Direkt in Datei (empfohlen für lokale Entwicklung)**

Öffnen Sie `src/environments/environment.ts` und konfigurieren Sie Ihren bevorzugten Provider:

```typescript
export const environment = {
  production: false,
  
  // LLM Provider Selection ('openai', 'b-api-openai', oder 'b-api-academiccloud')
  llmProvider: 'b-api-openai', // 👈 Provider wählen
  
  // OpenAI Configuration
  openai: {
    apiKey: 'sk-proj-...', // 👈 OpenAI API-Key
    model: 'gpt-4.1-mini',
    // ...
  },
  
  // B-API OpenAI Configuration (OpenAI-kompatibel)
  bApiOpenai: {
    apiKey: 'xxxxx-...', // 👈 B-API Key
    model: 'gpt-4.1-mini',
    baseUrl: 'https://b-api.staging.openeduhub.net/api/v1/llm/openai',
    // ...
  },
  
  // B-API AcademicCloud Configuration (DeepSeek-R1)
  bApiAcademicCloud: {
    apiKey: 'xxxxx-...', // 👈 Gleicher B-API Key
    model: 'deepseek-r1',
    baseUrl: 'https://b-api.staging.openeduhub.net/api/v1/llm/academiccloud',
    // ...
  }
};
```

**Provider-Übersicht:**

| Provider | Modell | Base URL | API-Key |
|----------|--------|----------|--------|
| `openai` | `gpt-4.1-mini` | OpenAI direkt | `OPENAI_API_KEY` |
| `b-api-openai` | `gpt-4.1-mini` | B-API OpenAI-Endpoint | `B_API_KEY` |
| `b-api-academiccloud` | `deepseek-r1` | B-API AcademicCloud | `B_API_KEY` |

**Option B: Als Environment Variable**

**Windows (PowerShell):**
```powershell
# Provider auswählen
$env:LLM_PROVIDER="b-api-openai"

# API-Keys
$env:OPENAI_API_KEY="sk-proj-..."
$env:B_API_KEY="xxxxx-..."
```

**Windows (CMD):**
```cmd
set LLM_PROVIDER=b-api-openai
set OPENAI_API_KEY=sk-proj-...
set B_API_KEY=xxxxx-...
```

**Linux/Mac:**
```bash
export LLM_PROVIDER="b-api-openai"
export OPENAI_API_KEY="sk-proj-..."
export B_API_KEY="xxxxx-..."
```

**Hinweis:** Environment Variables gelten nur für die aktuelle Session. Für permanente Konfiguration nutzen Sie Option A.

**Mehr Details:** Siehe `ENVIRONMENT_VARIABLES.md` für vollständige Dokumentation aller Konfigurations-Optionen.

### 4. Lokale Entwicklung starten

**WICHTIG: API-Key für Proxy setzen (im selben Terminal):**

**Für OpenAI:**
```powershell
# PowerShell
$env:OPENAI_API_KEY="sk-proj-..."

# CMD
set OPENAI_API_KEY=sk-proj-...
```

**Für B-API Provider:**
```powershell
# PowerShell
$env:B_API_KEY="xxxxx-..."

# CMD
set B_API_KEY=xxxxx-...
```

**Terminal 1: Proxy starten**
```bash
npm run proxy
```

**Wichtig:** Der lokale Proxy (`local-proxy.js`) unterstützt **alle drei Provider** automatisch!

**Terminal 2: App starten**
```bash
npm start
```

### 5. Browser öffnen
```
http://localhost:4200
```

**Fertig!** Die App läuft lokal ohne CORS-Probleme. 🎉

---

### Für Production Build:

```bash
# Sicherer Build mit automatischem Security Check (empfohlen)
npm run build:safe

# Oder: Standard Build ohne Check
npm run build

# Output in dist/ Verzeichnis
# Bereit für Deployment auf Netlify/Vercel
```

**💡 Tipp:** `build:safe` validiert, dass keine API-Keys im Bundle landen!

---

## 📦 Installation & Setup (Detailliert)

### Voraussetzungen

**Software:**
- **Node.js** >= 18.x ([Download](https://nodejs.org/))
- **npm** >= 9.x (kommt mit Node.js)
- **Git** ([Download](https://git-scm.com/))

**API-Zugang:**
- **OpenAI API-Key** ([Hier erstellen](https://platform.openai.com/api-keys))
  - Oder OpenAI-kompatibler Endpoint (Azure OpenAI, etc.)

**Prüfen Sie Ihre Installation:**
```bash
node --version    # Sollte v18.x oder höher sein
npm --version     # Sollte 9.x oder höher sein
git --version     # Sollte installiert sein
```

---

### Schritt 1: Repository klonen

```bash
# HTTPS (empfohlen)
git clone https://github.com/janschachtschabel/metadata-agent-canvas.git

# Oder SSH
git clone git@github.com:janschachtschabel/metadata-agent-canvas.git

# In das Projektverzeichnis wechseln
cd metadata-agent-canvas/webkomponente-canvas
```

---

### Schritt 2: Dependencies installieren

```bash
npm install
```

**Das installiert:**
- Angular 19
- RxJS
- Material Design
- @langchain/openai (für LLM-Integration)
- Weitere Dependencies (siehe `package.json`)

**Dauer:** 2-5 Minuten (abhängig von Internetverbindung)

**Bei Fehlern:**
```bash
# Cache leeren und neu installieren
npm cache clean --force
rm -rf node_modules package-lock.json  # Windows: rmdir /s node_modules & del package-lock.json
npm install
```

---

### Schritt 3: API-Key konfigurieren

#### Option A: Direkt in environment.ts (Lokal)

**Datei öffnen:** `src/environments/environment.ts`

```typescript
export const environment = {
  production: false,
  
  openai: {
    apiKey: 'sk-proj-...', // 👈 Ihren OpenAI API-Key hier eintragen
    baseUrl: '',           // Optional: Custom Endpoint (z.B. Azure)
    proxyUrl: '',          // Leer lassen (nutzt automatisch localhost:3001)
    model: 'gpt-4.1-mini',  // Empfohlen: Schnell & günstig
    temperature: 0.3,
    
    gpt5: {
      reasoningEffort: 'medium',
      verbosity: 'low'
    }
  },
  
  canvas: {
    maxWorkers: 10,  // Parallele Extraktionen (5-20)
    timeout: 30000   // Timeout pro Feld (ms)
  }
};
```

**Wichtig:** Diese Datei ist in `.gitignore` und wird **nicht** committet!

#### Option B: Environment Variable (Optional)

**Windows (PowerShell) - Empfohlen:**
```powershell
# Für aktuelle Session
$env:OPENAI_API_KEY="sk-proj-..."

# Oder permanent (System-weit):
[System.Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'sk-proj-...', 'User')
```

**Windows (CMD):**
```cmd
# Für aktuelle Session
set OPENAI_API_KEY=sk-proj-...

# Oder permanent:
setx OPENAI_API_KEY "sk-proj-..."
```

**Linux/Mac (Bash):**
```bash
# Für aktuelle Session
export OPENAI_API_KEY=sk-proj-...

# Oder permanent in ~/.bashrc oder ~/.zshrc:
echo 'export OPENAI_API_KEY=sk-proj-...' >> ~/.bashrc
source ~/.bashrc
```

**Vorteile:**
- API-Key nicht in Dateien
- Sicherer für geteilte Entwicklungsumgebungen
- Funktioniert auf allen Betriebssystemen

**Nachteile:**
- Muss bei jeder Session neu gesetzt werden (außer bei permanenter Konfiguration)
- Option A (Datei) ist einfacher für lokale Entwicklung

---

### Schritt 4: Lokale Entwicklung starten

**Warum 2 Terminals?**
- Die OpenAI API blockiert direkte Browser-Requests (CORS-Policy)
- Lösung: Lokaler Proxy-Server der Requests weiterleitet

#### Terminal 1: Proxy-Server starten

```bash
npm run proxy
```

**Erwartete Ausgabe:**
```
🚀 Starting local OpenAI proxy server...
📡 Proxy listening on: http://localhost:3001
🔑 Using API Key: sk-proj-xxxxxxxx...
✅ Proxy server ready!

📋 Next steps:
   1. Keep this terminal running
   2. In another terminal: npm start
   3. App will use this proxy automatically
```

**Wichtig:** Lassen Sie dieses Terminal **offen**!

#### Terminal 2: Angular App starten

```bash
npm start
```

**Erwartete Ausgabe:**
```
🔧 Processing environment files...
📋 Environment variables:
  - OPENAI_API_KEY: ✅ Found
  - OPENAI_MODEL: gpt-4.1-mini
✅ Environment processing complete

** Angular Live Development Server is listening on localhost:4200 **
✔ Compiled successfully.
```

**Dauer:** 10-20 Sekunden (erste Kompilierung)

---

### Schritt 5: App im Browser öffnen

```
http://localhost:4200
```

**Browser-Konsole sollte zeigen:**
```
🔧 Development mode: Using direct OpenAI API access (no proxy)
```

**Wenn Sie das sehen:** ✅ Alles funktioniert!

**Test durchführen:**
1. Text eingeben (z.B. "Mathematik-Kurs für Grundschüler")
2. "Extraktion starten" klicken
3. Felder werden automatisch gefüllt (6-10 Sekunden)
4. Keine CORS-Fehler! 🎉

---

## 🏗️ Production Build

### Build für Netlify/Vercel

**Standard Build:**
```bash
npm run build
```

**🔒 Sicherer Build mit Security Check (empfohlen):**
```bash
npm run build:safe
```

Dieser Befehl:
1. ✅ Validiert Environment Files (keine API-Keys im Code)
2. ✅ Erstellt Production Build
3. ✅ Scannt Bundle nach API-Keys
4. ✅ Garantiert sicheres Deployment

**Bundle-Security-Check (nach Build):**
```bash
npm run check-bundle
```

Scannt das fertige Bundle in `dist/` nach versehentlich inkludierten API-Keys.

**Ausgabe (Build + Security Check):**
```
🔒 SECURE Environment Configuration Validator
═══════════════════════════════════════════════
✅ Security check PASSED: No API keys in code
✅ Validation COMPLETE - Environment files are secure!

√ Browser application bundle generation complete.
Initial chunk files  | Names      | Raw size | Estimated transfer size
main.*.js            | main       | 438 kB   | 107 kB
styles.*.css         | styles     | 89 kB    | 7.5 kB

🔒 Bundle Security Check
═══════════════════════════════════════════════
📊 Files scanned: 5
✅ SUCCESS: No API keys found in bundle!
🎉 Bundle is secure and ready for deployment.
```

**Build-Artefakte:** `dist/` Verzeichnis

---

### Deployment auf Netlify

#### 1. Environment Variable setzen

**Netlify Dashboard → Ihr Site → Site Settings → Environment Variables**

```
Key:   OPENAI_API_KEY
Value: sk-proj-...
Scope: Production
```

#### 2. Deployen

**Option A: Git Push (empfohlen)**
```bash
git add .
git commit -m "Deploy: Production ready"
git push origin main
```

Netlify baut automatisch.

**Option B: Netlify CLI**
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

#### 3. Testen

Nach dem Deployment:
- Öffnen Sie Ihre Netlify-URL
- Browser-Konsole sollte zeigen:
  ```
  🚀 Production mode: Using Netlify Function proxy
  ```
- API-Key ist **nicht** im Code sichtbar ✅

---

## 🔄 Integration Modes

Die Canvas-Komponente unterstützt **drei Betriebsmodi** und erkennt automatisch, in welchem Modus sie läuft:

### 1. 🌐 Standalone Mode

**Wann:** Direkter Zugriff auf die deployed URL (z.B. `https://your-site.netlify.app`)

**Features:**
- ✅ Vollständige Canvas-UI
- ✅ Manuelle Text-Eingabe
- ✅ Submit zu Netlify Functions (Repository API)
- ✅ JSON-Download
- ❌ Kein Close-Button (volle Seite)

**Use Case:** Testing, manuelle Metadaten-Erstellung

---

### 2. 🔖 Bookmarklet Mode

**Wann:** Canvas wird als **iframe** auf einer Webseite eingeblendet (via Bookmarklet-Script)

**Features:**
- ✅ Canvas als Overlay (rechts, 600px)
- ✅ Close-Button (×)
- ✅ Mode-Badge: "Bookmarklet"
- ✅ URL automatisch übergeben via postMessage
- ✅ Submit zu Netlify Functions
- ✅ Automatisches Schließen nach Submit

**Workflow:**
```
Bookmarklet-Script ausführen
  ↓
Canvas öffnet als iframe
  ↓
postMessage: SET_PAGE_DATA (URL, Text)
  ↓
User extrahiert Metadaten
  ↓
Submit → Netlify Functions → Repository
  ↓
Canvas schließt sich
```

**Integration:** Siehe `src/assets/canvas-integration.js` für Bookmarklet-Code

---

### 3. 🧩 Browser-Plugin Mode

**Wann:** Canvas wird vom **WLO Browser Extension** geöffnet

**Features:**
- ✅ Canvas als iframe im Plugin (Sidebar, 600px)
- ✅ Close-Button (×)
- ✅ Mode-Badge: "Browser Extension"
- ✅ User-Badge: "Gast" oder "Username"
- ✅ **Vollständige Seiten-Extraktion** (HTML, Text, Meta-Tags, Structured Data)
- ✅ **Generischer Crawler-Daten** (optional)
- ✅ Submit via **postMessage** zurück an Plugin
- ❌ **KEIN** direkter Repository-Call (Plugin übernimmt!)

**Workflow:**
```
Browser-Plugin: "Werk vorschlagen"
  ↓
content-extractor.js extrahiert Seite
  ↓
Optional: Generischer Crawler API Call
  ↓
Plugin öffnet Canvas in iframe
  ↓
postMessage: PLUGIN_PAGE_DATA
  (url, html, text, metadata, crawlerData)
  ↓
Canvas empfängt & füllt Textarea
  ↓
User: "Generate" → LLM extrahiert Felder
  ↓
User bearbeitet Felder
  ↓
Submit: postMessage zurück an Plugin
  (CANVAS_METADATA_READY)
  ↓
Plugin: Repository API
  ↓
Success Notification
  ↓
Canvas schließt sich
```

**Integration:** Siehe `../metadata-browser-plugin/` für Plugin-Code

---

### 🔍 Automatische Mode-Detection

**Service:** `src/app/services/integration-mode.service.ts`

**Detection-Prioritäten:**
```typescript
1. URL-Parameter (?mode=browser-extension)
   ↓
2. iframe Check (window !== window.parent)
   → Lokal: "browser-extension"
   → Deployed: "bookmarklet" (default)
   ↓
3. postMessage Mode-Update
   → event.data.mode überschreibt
   ↓
4. Standalone (wenn nicht im iframe)
```

**Console Output (Beispiele):**
```
🖥️ Mode: Standalone (local development)
🌐 Mode: Standalone (deployed, direct access)
🔖 Mode: Bookmarklet (iframe, deployed)
🔌 Mode: Browser Extension (iframe, local)
```

---

### 📤 Mode-abhängiges Submit

**TypeScript:** `src/app/components/canvas-view/canvas-view.component.ts`

```typescript
async submitAsGuest() {
  const metadata = this.canvasService.getMetadataJson();
  
  // BROWSER-EXTENSION: postMessage an Plugin
  if (this.integrationMode.isBrowserExtension()) {
    this.integrationMode.sendMetadataToParent(metadata);
    this.integrationMode.requestClose();
    return;  // Kein Repository-Call!
  }
  
  // STANDALONE/BOOKMARKLET: Netlify Functions
  const result = await this.guestSubmission.submitAsGuest(metadata);
  // ... Repository-Submission
}
```

**Vorteile:**
- ✅ Ein Codebase für alle Modi
- ✅ Automatische Mode-Erkennung
- ✅ Korrekte Daten-Submission je Modus
- ✅ UI passt sich automatisch an

---

## 🎓 Workflow & Nutzung

```
┌─────────────────────────────────────────┐
│ 1. Text eingeben                        │
│    Beschreibung der Ressource           │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│ 2. "Extraktion starten" klicken         │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│ 3. Canvas füllt sich automatisch        │
│    ⚪ → ⏳ → ✅ (parallel, ~6-10s)       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│ 4. Felder bearbeiten (optional)         │
│    • Inline-Editing                     │
│    • Autocomplete bei Vokabularen       │
│    • Automatische Normalisierung        │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│ 5. Content-Type ggf. anpassen           │
│    → Neue Felder werden geladen         │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│ 6. "Bestätigen" → JSON-Download         │
└─────────────────────────────────────────┘
```

### 3. UI-Elemente

**Status-Icons:**
- ⚪ Leer (grau = optional, rot Rand = Pflichtfeld)
- ⏳ Wird extrahiert (orange, animiert)
- ✅ Gefüllt (grün)
- ❌ Fehler (rot)

**Feld-Features:**
- **Autocomplete**: Bei Vokabular-Feldern (z.B. Bildungsstufe)
- **Chips**: Array-Felder zeigen Werte als entfernbare Chips
- **Baum-Hierarchie**: Verschachtelte Felder (z.B. Location → Address → Street) mit visuellen Tree-Linien (├─ und └─)
- **Confidence-Badge**: KI-Sicherheit (0-100%) bei extrahierten Werten
- **Auto-Resize**: Textareas passen sich automatisch an

**Progress-Anzeige:**
- Fortschrittsbalken mit Prozent
- Felder-Zähler: `Gefüllt/Gesamt`
- Pflichtfelder-Status separat angezeigt

---

## 🗺️ Geocoding-Integration

Die App reichert Adressdaten **automatisch mit Geo-Koordinaten** an, bevor der JSON-Export erfolgt.

### Funktionsweise

**Wann wird geocodiert?**
- Beim Klick auf **"Bestätigen & JSON herunterladen"**
- **Vor** dem tatsächlichen Download
- **Nur** wenn Adress-Daten vorhanden sind

**Welche Felder werden geocodiert?**
- `schema:location` (Events, Bildungsangebote)
- `schema:address` (Organisationen)
- `schema:legalAddress` (Organisationen)

**API-Service:**
- Verwendet **Photon API** von Komoot (OpenStreetMap-basiert)
- **Kostenlos** und ohne API-Key
- **Rate Limit:** 1 Request/Sekunde (automatisch eingehalten)
- **Proxy-Support:** Netlify Function umgeht Browser-Blocker

### Beispiel: Vorher/Nachher

**Input (vom User oder KI extrahiert):**
```json
{
  "schema:location": [{
    "@type": "Place",
    "name": "Gasteig HP8",
    "address": {
      "streetAddress": "Hans-Preißinger-Straße 8",
      "postalCode": "81379",
      "addressLocality": "München"
    }
  }]
}
```

**Output (nach Geocoding beim Export):**
```json
{
  "schema:location": [{
    "@type": "Place",
    "name": "Gasteig HP8",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Hans-Preißinger-Straße 8",
      "postalCode": "81379",
      "addressLocality": "München",
      "addressRegion": "Bayern",          // ← Angereichert
      "addressCountry": "Deutschland",    // ← Angereichert
      "countryCode": "DE"                 // ← Angereichert
    },
    "geo": {                              // ← NEU!
      "@type": "GeoCoordinates",
      "latitude": 48.1173,
      "longitude": 11.5942
    }
  }]
}
```

### Features

**✅ Vorteile:**
- **Automatisch**: Keine manuelle Eingabe von Koordinaten
- **Genau**: OpenStreetMap-Datenbank
- **Anreicherung**: Ergänzt Bundesland, Land, Postleitzahl
- **Fehler-tolerant**: Export funktioniert auch wenn Geocoding fehlschlägt
- **Intelligent**: Überspringt bereits geocodete Locations
- **Schnell**: < 1 Sekunde pro Adresse

**🛡️ Technische Details:**
- **Rate Limiting:** 1 Request/Sekunde (Photon API-Limit)
- **Sequenzielle Verarbeitung:** Mehrere Adressen werden nacheinander verarbeitet
- **Netlify-Proxy:** Production-Build nutzt Server-side Proxy
- **Lokal:** Direkter API-Zugriff ohne Proxy
- **Caching:** 10 Minuten Cache auf Netlify (gleiche Adresse = kein erneuter Request)

### Konfiguration

Die Geocoding-Funktion ist **standardmäßig aktiviert** und benötigt keine Konfiguration.

**Services:**
- `geocoding.service.ts` - Photon API Integration
- `canvas.service.ts` - Anreicherungs-Logik vor Export
- `netlify/functions/photon.js` - Server-side Proxy für Production

**Logging:**
```
🗺️ Enriching data with geocoding...
🔧 Reconstructing schema:location from sub-fields before geocoding...
🗺️ Geocoding address: "Hans-Preißinger-Straße 8, 81379, München"
✅ Geocoded: 48.1173, 11.5942
✅ Geocoding enrichment complete: 1 locations geocoded
```

### Fehlerbehandlung

**Wenn Geocoding fehlschlägt:**
1. Browser-Konsole zeigt Fehler-Log
2. User erhält Bestätigungs-Dialog:
   ```
   Geocoding-Anreicherung fehlgeschlagen. Trotzdem herunterladen?
   ```
3. Download funktioniert auch ohne Geo-Daten

**Mögliche Fehler:**
- API nicht erreichbar
- Adresse nicht gefunden (zu ungenau)
- Rate Limit überschritten (bei vielen Adressen)
- Netzwerk-Probleme

---

## 🌳 Verschachtelte Felder & Baum-Hierarchie

Die App unterstützt **komplexe verschachtelte Felder** mit visueller Baum-Darstellung.

### Beispiel: Location-Feld

**Schema-Definition:**
```json
{
  "id": "schema:location",
  "datatype": "array",
  "items": {
    "type": "object",
    "shape": {
      "oneOf": [
        {
          "@type": "Place",
          "name": "string",
          "address": {
            "streetAddress": "string",
            "postalCode": "string",
            "addressLocality": "string"
          },
          "geo": {
            "latitude": "number",
            "longitude": "number"
          }
        }
      ]
    }
  }
}
```

### UI-Darstellung

**Baum-Hierarchie mit visuellen Linien:**
```
✓ Ort                      [Steubenstraße 34]      ℹ️
│
├─ ✓ Name                 [Hausparty]
├─ ✓ Street Address       [Steubenstraße 34]
├─ ⚪ Postal Code          [99423]
├─ ✓ Address Locality     [Weimar]
├─ ⚪ Address Region       []
└─ ✓ Address Country      [DE]
```

**Vorteile:**
- **Permanent sichtbar**: Keine aufklappbaren Details mehr
- **Visuell klar**: Tree-Lines zeigen Hierarchie
- **Inline-Editing**: Alle Sub-Fields direkt bearbeitbar
- **Alignment**: Input-Felder vertikal aligned
- **Responsive**: Funktioniert auf allen Bildschirmgrößen

### Sub-Field-Rendering

**Component:** `canvas-field.component.html`
- Parent-Feld zeigt Preview (z.B. erste gefüllte Sub-Field)
- Sub-Fields haben eigene Zeile mit Tree-Connector
- Status-Icons und Labels im grauen Bereich (links)
- Input-Felder im weißen Bereich (rechts)

**Shape-Expander Service:**
- Lädt `shape` aus Schema-Definition
- Erstellt automatisch Sub-Fields
- Rekonstruiert Objekte für JSON-Export
- Unterstützt verschachtelte Strukturen (mehrere Ebenen)

---

## 📋 Schema-Datenstruktur

Die Schemata befinden sich in `src/schemata/` und definieren Metadatenfelder.

### Feld-Definition

```json
{
  "id": "schema:startDate",
  "group": "schedule",
  "group_label": "Zeit & Status",
  "prompt": {
    "label": "Start (Datum/Zeit)",
    "description": "Start im ISO 8601-Format"
  },
  "system": {
    "path": "schema:startDate",
    "uri": "https://schema.org/startDate",
    "datatype": "date",
    "multiple": false,
    "required": false,
    "ask_user": true,
    "ai_fillable": true,
    "vocabulary": { ... },
    "validation": { ... },
    "normalization": { ... }
  }
}
```

### Wichtige Feld-Optionen

#### `system.datatype` - Datentyp

Steuert **Normalisierung** und **Validierung**:

| Datatype | Normalisierung | Beispiel |
|----------|----------------|----------|
| `string` | Trim, Deduplicate | Freitext |
| `date` | `15.9.2026` → `2026-09-15` | ISO 8601 Datum |
| `uri` / `url` | `example.com` → `https://example.com` | URLs |
| `number` / `integer` | `"zehn"` → `10` | Zahlen |
| `boolean` | `"ja"` → `true`, `"nein"` → `false` | Wahrheitswerte |
| `array` | siehe `multiple` | Arrays |
| `object` | Strukturierte Daten | JSON-Objekte |

**Auswirkung:**
- Bei `datatype: "date"` werden Eingaben wie `10.01.2027` automatisch zu `2027-01-10` konvertiert
- Bei `datatype: "url"` wird `example.com` zu `https://example.com`
- Bei `datatype: "string"` mit `vocabulary` wird Fuzzy-Matching angewendet

#### `system.multiple` - Mehrfachwerte

```json
{
  "datatype": "string",
  "multiple": true  // Feld akzeptiert mehrere Werte
}
```

**Auswirkung:**
- UI zeigt **Chips** statt einfachem Input
- Werte können einzeln hinzugefügt/entfernt werden
- Autocomplete schlägt bei jedem Chip-Hinzufügen vor

#### `system.required` - Pflichtfeld

```json
{
  "required": true  // Feld MUSS gefüllt werden
}
```

**Auswirkung:**
- Status-Icon wird **rot umrandet** wenn leer
- Validierung schlägt fehl wenn leer
- JSON-Export warnt bei fehlenden Pflichtfeldern

#### `system.ask_user` - User-Interaktion

```json
{
  "ask_user": true  // Feld wird im UI angezeigt
}
```

**Auswirkung:**
- `true`: Feld wird im Canvas angezeigt und kann editiert werden
- `false`: Feld wird nur intern verwendet (z.B. `@context`)

#### `system.ai_fillable` - KI-Extraktion

```json
{
  "ai_fillable": true  // KI versucht Feld zu füllen
}
```

**Auswirkung:**
- `true`: Feld wird während Extraktion automatisch gefüllt
- `false`: Feld muss manuell gefüllt werden

### Vocabulary - Kontrollierte Vokabulare

```json
{
  "vocabulary": {
    "type": "closed",  // oder "open", "skos"
    "concepts": [
      {
        "label": "Grundschule",
        "uri": "http://w3id.org/openeduhub/vocabs/educationalContext/grundschule",
        "altLabels": ["Primary School", "GS"]
      }
    ]
  }
}
```

**Vocabulary-Typen:**

| Type | Verhalten | Beispiel |
|------|-----------|----------|
| `closed` | Nur Werte aus Liste erlaubt | Bildungsstufe |
| `open` | Freie Eingabe + Vorschläge | Schlagwörter |
| `skos` | SKOS-Thesaurus | Fachgebiete |

**Auswirkung:**
- **Autocomplete**: Vorschläge während Eingabe
- **Fuzzy-Matching**: "Grundscule" → "Grundschule" (Levenshtein Distance < 3)
- **Label→URI Mapping**: "Grundschule" → `http://...grundschule`
- **Validierung**: Bei `closed` werden ungültige Werte abgelehnt

### Validation - Validierungsregeln

```json
{
  "validation": {
    "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
    "minLength": 3,
    "maxLength": 100
  }
}
```

**Auswirkung:**
- **pattern**: Regex-Validierung (z.B. Datum-Format)
- **minLength/maxLength**: String-Länge
- Ungültige Werte werden mit **❌** markiert

### Normalization - Normalisierungsregeln

```json
{
  "normalization": {
    "trim": true,
    "deduplicate": true,
    "map_labels_to_uris": true
  }
}
```

**Optionen:**

| Option | Funktion | Beispiel |
|--------|----------|----------|
| `trim` | Whitespace entfernen | `" Text "` → `"Text"` |
| `deduplicate` | Duplikate entfernen (Arrays) | `["A", "A"]` → `["A"]` |
| `map_labels_to_uris` | Label zu URI konvertieren | `"Grundschule"` → URI |

---

## ✅ Validierungs- und Normalisierungsverfahren

### 🆕 **NEU: Intelligente LLM-Fallback-Optimierung**

Die App verwendet jetzt eine **smarte 3-stufige Normalisierung**, die **unnötige API-Calls vermeidet**:

#### Stufe 1: Lokale Normalisierung (< 1ms) ⚡
Wird **sofort** auf User-Eingaben angewendet:

**Datumsformate:**
```
Input: "15.9.2026"   → Output: "2026-09-15"
Input: "15/09/2026"  → Output: "2026-09-15"
Input: "2026-09-15"  → Output: "2026-09-15" (unverändert)
```

**URLs:**
```
Input: "example.com"      → Output: "https://example.com"
Input: "http://test.de"   → Output: "http://test.de" (unverändert)
```

**Boolean:**
```
Input: "ja" / "yes" / "1" → Output: true
Input: "nein" / "no" / "0" → Output: false
```

**Zahlen:**
```
Input: "zehn"      → Output: 10
Input: "25"        → Output: 25
Input: "fünfzehn"  → Output: 15
```

### 2. Vocabulary-Matching

**Fuzzy-Matching** (Levenshtein Distance):
```
Input: "Grundscule"    → Match: "Grundschule" (Distance: 1)
Input: "Uniersität"    → Match: "Universität" (Distance: 1)
Input: "CC PY"         → Match: "CC BY" (Distance: 2)
```

**Alternative Labels:**
```
Input: "Primary School" → Match: "Grundschule" (altLabel)
Input: "GS"             → Match: "Grundschule" (altLabel)
```

### 3. Intelligente LLM-Prüfung 🧠

**NEU:** Bevor ein API-Call gemacht wird, prüft die App:

**✅ LLM wird ÜBERSPRUNGEN für:**
- Einfache Strings ohne Vocabulary
- Arrays ohne Vocabulary
- Bereits normalisierte Werte (Boolean, Number, Date, DateTime)
- Exakte Vocabulary-Matches (lokal validiert)

**⚠️ LLM wird NUR GERUFEN für:**
- Komplexe Datumsformate die lokaler Parser nicht versteht
- Komplexe Zahlenwörter ("einhundert", "zwei Dutzend")
- Vocabulary-Felder mit semantischer Matching-Anforderung (nach Fuzzy-Match fehlgeschlagen)

**Beispiel-Logs:**
```
⚡ Local validation succeeded: "OfflineEventAttendanceMode"
⏩ Skipping LLM normalization (not needed for simple case)
```

### 4. LLM-Fallback (~500ms)

Wird **nur noch selten** aufgerufen wenn lokale Normalisierung fehlschlägt:

**Komplexe Datumsformate:**
```
Input: "15. September 2026" → LLM → "2026-09-15"
Input: "morgen"             → LLM → Berechnet aktuelles Datum + 1
Input: "in 3 Tagen"         → LLM → Berechnet Datum
```

**Natürliche Zahlen:**
```
Input: "einhundert"         → LLM → 100
Input: "zwei Dutzend"       → LLM → 24
```

**Performance-Gewinn:**
- ⚡ 95% weniger API-Calls zur Normalisierung
- 💰 Deutlich reduzierte API-Kosten
- ⚡ Schnellere User-Eingabe-Verarbeitung (< 1ms statt ~500ms)

### 5. Validierung

**Pflichtfelder:**
- Status-Icon wird rot umrandet (⚠️) wenn leer
- JSON-Export zeigt Warnung

**Vokabular-Felder:**
- `closed`: Ungültige Werte werden abgelehnt → Feld wird geleert
- `open`: Alle Werte erlaubt, Vorschläge werden angezeigt

**Datentyp-Validierung:**
- `date`: Prüft ob Datum existiert (31.02. → ungültig)
- `uri`: Prüft URL-Format
- `number`: Prüft ob Zahl

**Regex-Patterns:**
```json
{
  "validation": {
    "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
  }
}
```
- Validiert gegen Regex
- Ungültige Werte → Status: ERROR (❌)

---

## 🏗️ Architektur

### Service-Layer

**CanvasService** (`canvas.service.ts`)
- State Management (RxJS BehaviorSubject)
- Orchestrierung: Core + Special Schema
- Content-Type-Erkennung
- **Zentrale Normalisierung** (einzige Stelle!)

**FieldExtractionWorkerPoolService** (`field-extraction-worker-pool.service.ts`)
- Parallele LLM-Aufrufe (max. 10 Worker)
- Queue-Management
- Retry-Logic

**FieldNormalizerService** (`field-normalizer.service.ts`)
- Lokale Normalisierung (Date, URL, Number, Boolean)
- Vocabulary Fuzzy-Matching
- LLM-Fallback

**SchemaLoaderService** (`schema-loader.service.ts`)
- Lädt JSON-Schemata aus `src/schemata/`
- Parst Feld-Definitionen

**ShapeExpanderService** (`shape-expander.service.ts`)
- Erweitert Felder mit `shape` zu Sub-Fields
- Erstellt hierarchische Feld-Strukturen
- Rekonstruiert verschachtelte Objekte für Export

**GeocodingService** (`geocoding.service.ts`)
- Photon API Integration
- Address → Geo-Koordinaten Konvertierung
- Rate Limiting (1 Request/Sekunde)
- Anreicherung mit Zusatzdaten (Bundesland, Land)

### Component-Layer

**CanvasViewComponent** (`canvas-view/`)
- Haupt-Container
- Gruppiert Felder
- Progress-Anzeige

**CanvasFieldComponent** (`canvas-field/`)
- Einzelfeld-Rendering
- Autocomplete
- Chips (Arrays)
- Status-Icons

### Data-Flow

```
User Input
  ↓
canvas-field.component.ts
  ↓ (emitChange)
canvas-view.component.ts
  ↓ (onFieldChange)
canvas.service.ts (updateFieldValue)
  ↓ (normalizeFieldValue)
field-normalizer.service.ts
  ↓ (tryLocalNormalization OR LLM)
Normalisierter Wert
  ↓ (updateFieldStatus)
canvas-field.component.ts (ngOnChanges)
  ↓ (updateInputValue)
UI zeigt normalisierten Wert ✅
```

---

## ⚡ Performance

### Parallelisierung

**Vorher (Chat-Version):** Sequenziell, ~40-50s
```
Feld 1 → Feld 2 → Feld 3 → ... → Feld 30
```

**Nachher (Canvas-Version):** Parallel, ~6-10s
```
Feld 1  ┐
Feld 2  ├─→ Batch 1 (10 parallel)
...     │
Feld 10 ┘
Feld 11 ┐
...     ├─→ Batch 2 (10 parallel)
Feld 20 ┘
Feld 21 ┐
...     ├─→ Batch 3 (10 parallel)
Feld 30 ┘
```

**Konfiguration:**
```typescript
// In field-extraction-worker-pool.service.ts
BATCH_SIZE = 10;           // Max parallele Requests
BATCH_DELAY_MS = 100;      // Pause zwischen Batches (Rate-Limit)
```

### Performance-Gewinn

- **Extraktion**: 80% schneller (40-50s → 6-10s)
- **Normalisierung**: 🆕 < 1ms (lokal), ~500ms (LLM-Fallback - nur noch selten benötigt!)
- **Normalisierungs-API-Calls**: 🆕 95% Reduktion durch intelligente LLM-Prüfung
- **UI-Updates**: Echtzeit (RxJS Streams)

### Kosten

- **API-Requests Extraktion**: +40-50% mehr Requests (durch Parallelisierung)
- **API-Requests Normalisierung**: 🆕 -95% weniger Requests (durch intelligente LLM-Prüfung)
- **Token-Verbrauch**: +150-200% (Extraktion), 🆕 -95% (Normalisierung)
- **Gesamt-Trade-off**: Bessere UX vs. moderat höhere Kosten (durch Normalisierungs-Optimierung deutlich reduziert)

---

## 🔨 Build & Deployment

### Verfügbare NPM Scripts

| Script | Beschreibung |
|--------|--------------|
| `npm start` | Development Server (localhost:4200) mit Pre-Build Security Check |
| `npm run proxy` | Startet lokalen Universal Proxy (localhost:3001) |
| `npm run start:all` | Startet Proxy + Angular parallel (empfohlen für lokal) |
| `npm run dev` | Netlify Dev Server mit Functions |
| `npm run build` | Production Build mit Pre-Build Validation |
| `npm run build:safe` | 🔒 Build + Bundle Security Check (empfohlen) |
| `npm run check-bundle` | Scannt Bundle nach API-Keys (nach Build) |
| `npm test` | Unit Tests |
| `npm run lint` | Code Linting |

**💡 Empfohlen für Production:** `npm run build:safe`

### Development

```bash
# Terminal 1: Proxy starten
npm run proxy

# Terminal 2: App starten
npm start

# Oder beides zusammen:
npm run start:all
```

Läuft auf: `http://localhost:4200`

### Production Build

**Sicherer Build (empfohlen):**
```bash
npm run build:safe
```

Führt aus:
1. ✅ Pre-Build Security Validation
2. ✅ Production Build
3. ✅ Post-Build Bundle Scan

**Standard Build:**
```bash
npm run build
```

Build-Artefakte in: `dist/`

### Security Checks

**Vor Build:**
- `validate-env.js` prüft `environment.ts`/`environment.prod.ts`
- Schlägt fehl wenn API-Keys gefunden

**Nach Build:**
```bash
npm run check-bundle
```
- Scannt `dist/**/*.js` nach Keys
- Garantiert sicheres Bundle

### Environment-Konfiguration

**Development:** `src/environments/environment.ts`
**Production:** `src/environments/environment.prod.ts`

Angular ersetzt automatisch beim Build:
```bash
ng build --configuration production
```

---

## 📚 Verfügbare Schemata

Die Schemata befinden sich in `src/schemata/`:

- **core.json** - Basis-Metadaten (Titel, Beschreibung, Lizenz, etc.)
- **event.json** - Veranstaltungen
- **education_offer.json** - Bildungsangebote
- **learning_material.json** - Lernmaterialien
- **person.json** - Personen
- **organization.json** - Organisationen
- **tool_service.json** - Tools & Services
- **occupation.json** - Berufe
- **didactic_planning_tools.json** - Didaktische Werkzeuge
- **source.json** - Quellen

---

## 🛠️ Technologie-Stack

### Frontend
- **Angular 19** - Framework
- **RxJS** - Reactive Programming
- **TypeScript** - Typsicherheit
- **Material Design** - UI-Komponenten

### LLM-Integration (Multi-Provider)
- **OpenAI API** - Direkte Integration (GPT-4.1-mini, GPT-4o-mini)
- **B-API OpenAI** - OpenAI-kompatible Modelle via B-API Endpoint
- **B-API AcademicCloud** - DeepSeek-R1 via B-API Endpoint
- **Lokaler Proxy** - `local-proxy.js` für alle Provider (Development)
- **Netlify Functions** - Provider-agnostischer Proxy (Production)

### Externe APIs
- **OpenAI API** via Netlify Function (`netlify/functions/openai-proxy.js`)
  - Unterstützt: `openai`, `b-api-openai`, `b-api-academiccloud`
  - Automatisches Routing basierend auf `llmProvider`
- **Photon Geocoding API** via Netlify Function (`netlify/functions/photon.js`)
  - OpenStreetMap-basiert
  - Rate Limiting: 1 Request/Sekunde

---

## 💡 Tipps & Best Practices

### Schema-Design

**Datatype richtig wählen:**
- Datumfelder immer als `"date"` definieren (nicht `"string"`)
- URLs als `"uri"` oder `"url"` 
- Mehrfachwerte: `"multiple": true` setzen

**Vocabulary verwenden:**
- `"type": "closed"` für strenge Kontrolle (z.B. Bildungsstufe)
- `"type": "open"` für Freitext + Vorschläge (z.B. Keywords)
- `altLabels` für Synonyme definieren

**Validierung hinzufügen:**
- `pattern` für Format-Vorgaben (z.B. ISBN, Datum)
- `required: true` für Pflichtfelder
- `minLength`/`maxLength` für Textlänge

### Performance-Tuning

**Batch-Size anpassen:**
```typescript
// In field-extraction-worker-pool.service.ts
BATCH_SIZE = 10;  // Erhöhen für schnellere Extraktion (mehr parallele Requests)
```

**Rate-Limiting:**
```typescript
BATCH_DELAY_MS = 100;  // Reduzieren nur wenn API-Limit erhöht
```

### Debugging

**Console-Logs aktivieren:**
- Alle Services loggen mit Emoji-Präfixen
- 🔵 = canvas-field.component
- 📝 = canvas.service
- 🔧 = field-normalizer.service
- ✅ = Erfolg, ❌ = Fehler, ⚠️ = Warnung

**Browser DevTools:**
- F12 → Console für Logs
- Network-Tab für API-Requests
- Angular DevTools für State-Inspektion

---

## 📦 Weitere Dokumentation

- **ENVIRONMENT_VARIABLES.md** - 🆕 **NEU:** Vollständige Dokumentation aller LLM-Provider und Environment Variables
- **INSTALLATION.md** - Detaillierte Setup-Anleitung
- **CANVAS_DOCUMENTATION.md** - Canvas-Architektur
- **PERFORMANCE.md** - Performance-Optimierungen
- **ENVIRONMENT_CONFIG.md** - Environment-Konfiguration
- **CODE_REVIEW_SUMMARY.md** - Code-Review Ergebnisse

---

## 📄 Lizenz

Entsprechend der Hauptanwendung

---

**Entwickelt mit ❤️ für schnelle, zuverlässige Metadaten-Extraktion**

---

## 🚫 Troubleshooting

### ❌ CORS-Fehler: "Access to fetch blocked"

**Symptom:**
```
Access to fetch at 'https://api.openai.com/v1/chat/completions' from origin 
'http://localhost:4200' has been blocked by CORS policy
```

**Ursache:** Proxy-Server läuft nicht

**Lösung:**
```bash
# Terminal 1: Proxy starten
npm run proxy

# Terminal 2: App starten
npm start
```

**Wichtig:** Beide Terminals müssen gleichzeitig laufen!

---

### ❌ Fehler: "Port 3001 already in use"

**Symptom:** Proxy kann nicht starten

**Lösung Windows:**
```bash
# Port-Nutzung prüfen
netstat -ano | findstr :3001

# Prozess beenden (PID aus vorherigem Befehl)
taskkill /PID <PID> /F

# Proxy neu starten
npm run proxy
```

**Lösung Linux/Mac:**
```bash
# Prozess finden und beenden
lsof -ti:3001 | xargs kill -9

# Proxy neu starten
npm run proxy
```

---

### ❌ Fehler: "OPENAI_API_KEY environment variable is not set"

**Symptom:** Proxy startet nicht, Fehlermeldung beim Start

**Lösung:**
Setzen Sie die Environment Variable **vor** dem Start des Proxys:

**Windows (PowerShell):**
```powershell
$env:OPENAI_API_KEY="sk-proj-..."
npm run proxy
```

**Windows (CMD):**
```cmd
set OPENAI_API_KEY=sk-proj-...
npm run proxy
```

**Linux/Mac:**
```bash
export OPENAI_API_KEY=sk-proj-...
npm run proxy
```

**Alternative:** Konfigurieren Sie den Key in `src/environments/environment.ts` (dann ist die Environment Variable nicht nötig).

---

### ❌ Fehler: "API key not configured" (in der App)

**Symptom:** App startet, aber Extraktion funktioniert nicht

**Lösung:**
1. Öffnen Sie `src/environments/environment.ts`
2. Fügen Sie Ihren API-Key ein:
   ```typescript
   apiKey: 'sk-proj-...' // Ihr echter Key
   ```
3. Speichern
4. App neu starten (Strg + C, dann `npm start`)

---

### ❌ Fehler: "Failed to compile"

**Symptom:** Angular Build schlägt fehl

**Lösung:**
```bash
# Dependencies neu installieren
rm -rf node_modules package-lock.json
npm install

# Cache leeren
npm cache clean --force

# Neu starten
npm start
```

---

### ⚠️ Browser zeigt alte Version

**Symptom:** Code-Änderungen werden nicht angezeigt

**Lösung:**
1. Hard-Refresh: **Strg + Shift + R** (Windows/Linux) oder **Cmd + Shift + R** (Mac)
2. Oder: Browser-Cache leeren
3. Oder: Inkognito-Modus verwenden

---

### ❌ Netlify Build schlägt fehl

**Symptom:** Deployment Error auf Netlify

**Lösung:**
1. Prüfen Sie Netlify Build-Logs
2. Stellen Sie sicher:
   - Environment Variable `OPENAI_API_KEY` ist gesetzt
   - `environment.prod.ts` hat **leeren** API-Key
   - `netlify.toml` ist korrekt konfiguriert
3. Trigger Redeploy in Netlify Dashboard

---

### 🔍 Debug-Modus aktivieren

**Browser-Konsole öffnen:** F12

**Nach diesen Meldungen suchen:**
```
🔧 Development mode: Using direct OpenAI API access (no proxy)
✅ = Erfolgreich konfiguriert
```

```
🚀 Production mode: Using Netlify Function proxy
✅ = Production-Modus aktiv
```

**Proxy-Terminal prüfen:**
```
📤 Proxying request to OpenAI API...
   Model: gpt-4.1-mini
   Messages: 1
✅ Response received from OpenAI (200)
```

---

## 📝 Command Reference

### Development Commands

| Command | Beschreibung | Terminal |
|---------|--------------|----------|
| `npm run proxy` | Startet lokalen Proxy-Server (Port 3001) | Terminal 1 |
| `npm start` | Startet Angular Dev-Server (Port 4200) | Terminal 2 |
| `npm run build` | Production Build (Output: `dist/`) | Beliebig |
| `npm test` | Unit Tests ausführen | Beliebig |
| `npm run lint` | Code-Qualität prüfen | Beliebig |

### Shortcuts während Entwicklung

| Aktion | Shortcut (Windows/Linux) | Shortcut (Mac) |
|--------|-------------------------|----------------|
| Dev-Server stoppen | Strg + C | Cmd + C |
| Hard-Refresh Browser | Strg + Shift + R | Cmd + Shift + R |
| Browser-Konsole | F12 | Cmd + Option + I |
| DevTools | F12 | Cmd + Option + J |

### Netlify Commands

```bash
# Netlify CLI installieren (einmalig)
npm install -g netlify-cli

# Login
netlify login

# Lokaler Test mit Netlify Functions
netlify dev

# Production Deployment
netlify deploy --prod

# Build-Logs anzeigen
netlify logs

# Environment Variables verwalten
netlify env:list
netlify env:set OPENAI_API_KEY sk-proj-...
```

---

## ❓ FAQ (Häufig gestellte Fragen)

### Q: Warum brauche ich 2 Terminals?
**A:** Die OpenAI API blockiert direkte Browser-Requests (CORS-Policy). Der lokale Proxy-Server umgeht dieses Problem, indem er Requests weiterleitet und CORS-Header hinzufügt.

### Q: Funktioniert das auch ohne Proxy?
**A:** Nein, nicht lokal. Browser blockieren direkte API-Aufrufe zu OpenAI. Auf Netlify funktioniert es automatisch über Netlify Functions.

### Q: Kann ich einen anderen Port verwenden?
**A:** Ja! Ändern Sie in `local-proxy.js` die Zeile:
```javascript
const PORT = 3001; // Ändern Sie auf z.B. 8080
```
Und in `src/app/services/openai-proxy.service.ts`:
```typescript
const apiUrl = 'http://localhost:3001/v1/chat/completions'; // Port anpassen
```

### Q: Wie viel kostet die OpenAI API-Nutzung?
**A:** Mit `gpt-4.1-mini`:
- **Input:** $0.15 / 1M Tokens
- **Output:** $0.60 / 1M Tokens
- **Pro Extraktion:** ~$0.003-0.005 (ca. 30 Felder)
- **1000 Extraktionen:** ~$3-5

### Q: Kann ich ein anderes Modell verwenden?
**A:** Ja! In `environment.ts`:
```typescript
model: 'gpt-4o-mini'  // Günstiger, aber weniger genau
model: 'gpt-4.1'         // Teurer, aber genauer
model: 'gpt-4.1-mini'    // Empfohlen: Balance aus Preis/Qualität
```

### Q: Wo werden meine Daten gespeichert?
**A:** 
- **Lokal:** Nur im Browser (LocalStorage/SessionStorage)
- **OpenAI:** Requests werden verarbeitet, gemäß [OpenAI Privacy Policy](https://openai.com/policies/privacy-policy)
- **Netlify:** Keine Datenspeicherung, nur Request-Weiterleitung

### Q: Ist mein API-Key sicher?
**A:**
- **Lokal:** Key ist in `environment.ts` (in `.gitignore`, wird nicht committed)
- **Production:** Key ist in Netlify Environment Variables (verschlüsselt, nicht im Code)
- **Wichtig:** Niemals API-Key in Git committen!

### Q: Kann ich das auch offline nutzen?
**A:** Nein, die App benötigt Internetzugang für:
- OpenAI API-Aufrufe
- Schema-Downloads
- Optional: Vokabular-Updates

### Q: Unterstützt die App mehrere Sprachen?
**A:** Die Prompts sind auf Deutsch, aber die App kann Text in beliebigen Sprachen verarbeiten. Die KI passt sich automatisch an.

---

## 🔗 Nützliche Links

**Projekt:**
- **Repository:** https://github.com/janschachtschabel/metadata-agent-canvas
- **Issues:** https://github.com/janschachtschabel/metadata-agent-canvas/issues
- **Releases:** https://github.com/janschachtschabel/metadata-agent-canvas/releases

**APIs & Frameworks:**
- **OpenAI API Docs:** https://platform.openai.com/docs
- **OpenAI API Keys:** https://platform.openai.com/api-keys
- **OpenAI Pricing:** https://openai.com/api/pricing
- **Netlify Docs:** https://docs.netlify.com
- **Angular Docs:** https://angular.dev

---

## 📬 Weitere Dokumentation

### Detaillierte Anleitungen
- **START_LOCAL.md** - Schnellstart-Anleitung (2 Terminals)
- **LOCAL_DEVELOPMENT.md** - Lokale Entwicklung ohne Netlify CLI
- **CORS_FIX.md** - CORS-Problem und Lösung erklärt
- **INSTALLATION.md** - Erweiterte Installation

### Technische Dokumentation
- **CANVAS_DOCUMENTATION.md** - Canvas-Architektur
- **PERFORMANCE.md** - Performance-Optimierungen & Benchmarks
- **ENVIRONMENT_CONFIG.md** - Alle Konfigurationsoptionen
- **SECURITY_CHECKLIST.md** - Sicherheits-Checkliste vor Git Commit

### Deployment
- **DEPLOY.md** - Vercel/Netlify Deployment-Anleitung
- **CHANGES_FOR_GIT.md** - Änderungen für Git-Repository

---

## 🤝 Beitragen

Beiträge sind willkommen! Bitte:
1. Fork das Repository
2. Erstellen Sie einen Feature-Branch (`git checkout -b feature/AmazingFeature`)
3. Committen Sie Ihre Änderungen (`git commit -m 'Add some AmazingFeature'`)
4. Pushen Sie zum Branch (`git push origin feature/AmazingFeature`)
5. Öffnen Sie einen Pull Request

**Wichtig:** Prüfen Sie vorher `SECURITY_CHECKLIST.md` - keine API-Keys committen!

---

## 📄 Lizenz

Apache License 2.0

Siehe [LICENSE](LICENSE) Datei für Details.

Copyright 2025 Jan Schachtschabel

---

## 👏 Credits

**Entwickelt mit ❤️ für schnelle, zuverlässige Metadaten-Extraktion**

**Technologie-Stack:**
- Angular 19
- RxJS
- Material Design
- LangChain
- OpenAI API
- Netlify Functions
