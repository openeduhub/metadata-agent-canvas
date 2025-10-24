# 🚀 Lokale Entwicklung starten

## ⚡ Schnellstart (2 Schritte)

### Schritt 1: .env Datei erstellen

**Wichtig:** Der Proxy benötigt API-Keys aus `.env` Datei!

```powershell
# Kopieren Sie das Template
cp .env.template .env

# Öffnen und API-Keys eintragen
notepad .env
```

**Beispiel `.env` Inhalt:**
```bash
LLM_PROVIDER=b-api-openai
B_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
OPENAI_API_KEY=sk-proj-your-key
```

**Wichtig:** `.env` ist in `.gitignore` und wird **NICHT** ins Repository committed!

### Schritt 2: Development starten

**Option 1: Beide zusammen (EMPFOHLEN) ⭐**

```powershell
# Installiert concurrently (einmalig)
npm install

# Startet Proxy + Angular zusammen
npm run start:all
```

**Option 2: PowerShell Script (Windows)**

```powershell
.\start-dev.ps1
```

Öffnet 2 PowerShell-Fenster:
- Fenster 1: Universal Proxy (Port 3001)
- Fenster 2: Angular Dev Server (Port 4200)

**Option 3: Zwei separate Terminals**

```powershell
# Terminal 1: Proxy starten
npm run proxy

# Terminal 2: Angular starten (neues Terminal!)
npm start
```

**Option 4: Bash Script (Linux/Mac)**

```bash
chmod +x start-dev.sh
./start-dev.sh
```

### Erfolgreich, wenn Sie sehen:

**Proxy (Port 3001):**
```
🚀 Starting Universal API Proxy...
📡 Proxy listening on: http://localhost:3001

🔌 Supported endpoints:
   • /llm          - LLM APIs (OpenAI, B-API)
   • /geocoding   - Photon Geocoding
   • /repository  - edu-sharing Repository

🔑 OpenAI API Key: sk-proj-...
🔑 B-API Key: xxxxxxxx-xxxx-...
```

**Angular (Port 4200):**
```
✅ Environment processing complete
** Angular Live Development Server is listening on localhost:4200 **
```

**Dann Browser öffnen:**
```
http://localhost:4200
```

**Das war's!** Die App verwendet automatisch den lokalen Proxy. Kein CORS-Problem mehr! ✅

---

## 🔍 Wie funktioniert es?

```
Browser (Port 4200) → Local Proxy (Port 3001) → OpenAI API
                       ✅ CORS headers added
```

**Der lokale Proxy:**
- Läuft auf Port 3001
- Leitet Requests an OpenAI API weiter
- Fügt CORS-Headers hinzu (erlaubt Browser-Zugriff)
- Verwendet Ihren API-Key aus `environment.ts`

---

## 🐛 Troubleshooting

### Fehler: "Port 3001 already in use"
**Problem:** Proxy läuft bereits

**Lösung:**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Dann neu starten
npm run proxy
```

### Fehler: "Failed to fetch" / CORS error
**Problem:** Proxy läuft nicht

**Lösung:**
Prüfen Sie, ob Terminal 1 mit dem Proxy noch läuft:
```
📡 Proxy listening on: http://localhost:3001
```

Falls nicht, starten Sie neu: `npm run proxy`

### Fehler: "API key not configured"
**Problem:** `.env` Datei fehlt oder ist leer

**Lösung:**
```powershell
# 1. Kopieren Sie das Template
cp .env.template .env

# 2. Öffnen und Keys eintragen
notepad .env

# 3. Proxy neu starten
npm run proxy
```

**Wichtig:** `environment.ts` sollte `apiKey: ''` (leer) haben - Keys kommen aus `.env`!

### Fehler: `ERR_CONNECTION_REFUSED` auf localhost:3001
**Problem:** Proxy läuft nicht

**Lösung:**
```powershell
# Prüfen Sie, ob Proxy läuft
# Sollte in Terminal 1 sichtbar sein:
📡 Proxy listening on: http://localhost:3001

# Falls nicht: Starten Sie neu
npm run proxy
```

**Oder nutzen Sie:**
```powershell
npm run start:all  # Startet beides zusammen
```

**Vollständige Hilfe:** Siehe `TROUBLESHOOTING.md`

---

## 📊 Console-Meldungen (normal)

**Proxy-Terminal:**
```
📤 Proxying request to OpenAI API...
   Model: gpt-4o-mini
   Messages: 1
✅ Response received from OpenAI (200)
```

**Browser-Console:**
```
🔧 Development mode: Using direct OpenAI API access (no proxy)
🔍 Extracting field: Titel (ccm:title)
✅ Extracted Titel: "Mathematik Grundkurs"
```

---

## ⚙️ Konfiguration

### API-Keys ändern
**In:** `.env` Datei (nicht in Git!)
```bash
OPENAI_API_KEY=sk-proj-new-key
B_API_KEY=new-uuid-key
```

**Proxy neu starten** nach Änderungen!

### LLM Provider wechseln
**In:** `.env` oder `environment.ts`
```bash
LLM_PROVIDER=openai              # OpenAI direkt
LLM_PROVIDER=b-api-openai        # B-API OpenAI-kompatibel
LLM_PROVIDER=b-api-academiccloud # B-API AcademicCloud
```

### Modell ändern
**In:** `environment.ts`
```typescript
model: 'gpt-4.1-mini' // Oder: gpt-4o, gpt-5-mini, etc.
```

### Proxy-Port ändern
**In:** `local-proxy.js` (Zeile 11)
```javascript
const PORT = 3001; // Ändern Sie auf einen anderen Port
```

**Dann auch in:** `src/app/services/openai-proxy.service.ts` (Zeile 79)
```typescript
const apiUrl = 'http://localhost:3001/v1/chat/completions'; // Port anpassen
```

---

## 🎯 Workflow

### Neue Session starten

**Empfohlen:**
```powershell
npm run start:all  # Startet beides zusammen
```

**Oder manuell:**
1. Terminal 1: `npm run proxy`
2. Terminal 2: `npm start`
3. Browser: `http://localhost:4200`

**Oder PowerShell Script:**
```powershell
.\start-dev.ps1  # Windows
./start-dev.sh   # Linux/Mac
```

### Session beenden

**Bei `npm run start:all`:**
- Drücken Sie **Ctrl + C** einmal (stoppt beide)

**Bei zwei Terminals:**
- Terminal 1: Ctrl + C (Proxy stoppen)
- Terminal 2: Ctrl + C (App stoppen)

**Bei PowerShell Script:**
- Schließen Sie beide PowerShell-Fenster

### Code ändern
- Proxy: Läuft weiter (muss nicht neu gestartet werden)
- Angular: Kompiliert automatisch neu (HMR)
- Browser: Automatisches Reload

### .env ändern
- **Proxy NEU STARTEN** nach `.env` Änderungen!
- Angular: Läuft weiter

---

## 🚀 Production Build

Wenn Sie auf Netlify deployen:
```bash
npm run build
git push
```

**Production verwendet:**
- ❌ **Nicht** den lokalen Proxy
- ✅ Netlify Function Proxy (automatisch)
- ✅ API-Key aus Netlify Environment Variables

---

## 💡 Vorteile dieser Lösung

| Feature | Status |
|---------|--------|
| **Keine CORS-Fehler** | ✅ |
| **Einfach zu starten** | ✅ Nur `npm run proxy` + `npm start` |
| **Kein Netlify CLI nötig** | ✅ |
| **Schnelle Entwicklung** | ✅ |
| **Production-ready** | ✅ Netlify Function verwendet |
| **API-Key sicher** | ✅ Nur lokal, nicht im Build |

---

## 📚 Weitere Dokumentation

- **CORS_FIX.md** - Warum CORS ein Problem ist
- **LOCAL_DEVELOPMENT.md** - Detaillierte Erklärungen
- **ENVIRONMENT_CONFIG.md** - Alle Konfigurationsoptionen

---

**Jetzt loslegen! 🎉**

Terminals öffnen und:
1. `npm run proxy`
2. `npm start`
