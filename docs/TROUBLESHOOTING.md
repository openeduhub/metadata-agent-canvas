# 🐛 Troubleshooting Guide

**Projekt:** webkomponente-canvas  
**Häufige Probleme und Lösungen**

---

## 🔴 Problem: `ERR_CONNECTION_REFUSED` auf localhost:3001

### Symptom

```
POST http://localhost:3001/ net::ERR_CONNECTION_REFUSED
⚠️ OpenAI API error (attempt 1/4): Failed to fetch
```

### Ursache

Der **Universal Proxy läuft nicht**. Angular versucht auf `localhost:3001` zuzugreifen, aber der Proxy ist nicht gestartet.

### Lösung

**Option 1: Zwei separate Terminals**

```powershell
# Terminal 1: Proxy starten
npm run proxy

# Terminal 2: Angular starten (neues Terminal öffnen)
npm start
```

**Option 2: Beide gleichzeitig (mit concurrently)**

```powershell
# Installieren Sie concurrently (einmalig)
npm install --save-dev concurrently

# Starten Sie beide zusammen
npm run start:all
```

**Option 3: PowerShell Script (Windows)**

```powershell
# Führen Sie das Start-Script aus
.\start-dev.ps1
```

**Option 4: Bash Script (Linux/Mac)**

```bash
# Ausführbar machen
chmod +x start-dev.sh

# Ausführen
./start-dev.sh
```

### Verifizierung

**Proxy läuft erfolgreich, wenn Sie sehen:**

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

**Testen Sie den Proxy:**

```powershell
# PowerShell
Invoke-WebRequest -Uri http://localhost:3001/health -Method GET

# Sollte antworten mit: 200 OK
```

---

## 🔴 Problem: API-Keys nicht gefunden

### Symptom

```
🔑 OpenAI API Key: undefined
🔑 B-API Key: undefined
```

### Ursache

Die `.env` Datei existiert nicht oder ist leer.

### Lösung

```powershell
# 1. Kopieren Sie das Template
cp .env.template .env

# 2. Öffnen Sie .env und fügen Sie Ihre Keys ein
notepad .env

# 3. Beispiel .env Inhalt:
# LLM_PROVIDER=b-api-openai
# B_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# OPENAI_API_KEY=sk-proj-your-key
```

**Wichtig:** 
- `.env` ist in `.gitignore` und wird NICHT committed
- Starten Sie den Proxy neu nach `.env` Änderungen

---

## 🔴 Problem: Port 3001 bereits in Verwendung

### Symptom

```
Error: listen EADDRINUSE: address already in use :::3001
```

### Ursache

Ein anderer Prozess nutzt bereits Port 3001.

### Lösung

**Option 1: Anderen Prozess beenden (Windows)**

```powershell
# Finden Sie den Prozess auf Port 3001
netstat -ano | findstr :3001

# Beenden Sie den Prozess (ersetzen Sie PID)
taskkill /PID <PID> /F
```

**Option 2: Anderen Prozess beenden (Linux/Mac)**

```bash
# Finden und beenden
lsof -ti:3001 | xargs kill -9
```

**Option 3: Port in local-universal-proxy.js ändern**

```javascript
// local-universal-proxy.js
const PORT = 3002; // ← Ändern Sie zu einem freien Port
```

**Dann auch in `environment.ts` anpassen:**

```typescript
proxyUrl: 'http://localhost:3002/llm', // ← Neuer Port
```

---

## 🔴 Problem: 404 bei Page Refresh

### Symptom

Direkte URLs wie `/events` geben 404 (nur lokal).

### Ursache

Angular Dev Server kennt die Route nicht (CSR Problem).

### Lösung

**Das ist normal im Development!** Angular Router übernimmt nach Initial Load.

**Workaround:**
1. Gehen Sie zu `http://localhost:4200` (Root)
2. Navigieren Sie dann zu `/events`

**Production:** Netlify nutzt SPA Fallback Redirects (`netlify.toml`), dort funktioniert es.

---

## 🔴 Problem: CORS-Fehler

### Symptom

```
Access to XMLHttpRequest at '...' from origin 'http://localhost:4200' 
has been blocked by CORS policy
```

### Ursache

Direkte API-Calls ohne Proxy.

### Lösung

**Prüfen Sie, dass der Proxy läuft:**

```powershell
npm run proxy  # Terminal 1
```

**Prüfen Sie `environment.ts`:**

```typescript
proxyUrl: 'http://localhost:3001/llm', // ← Muss gesetzt sein
```

**Weitere Infos:** Siehe `CORS_FIX.md`

---

## 🔴 Problem: Build schlägt fehl - "Secret detected"

### Symptom

```
❌ Secret scanning: Detected secret values
   Location: dist/main.abc123.js
```

### Ursache

API-Key wurde ins Bundle injiziert (SICHERHEITSRISIKO!).

### Lösung

**1. Prüfen Sie `environment.prod.ts`:**

```typescript
openai: {
  apiKey: '', // ← MUSS leer sein!
}
```

**2. Prüfen Sie `replace-env.js`:**

Key-Injection sollte deaktiviert sein für production.

**3. Lokalen Build testen:**

```powershell
npm run build:prod

# Bundle prüfen
Select-String -Path "dist/main*.js" -Pattern "sk-proj|bb6cdf"
# Sollte NICHTS finden!
```

**Weitere Infos:** Siehe `NETLIFY_SECRETS_CONTROLLER.md`

---

## 🔴 Problem: Bundle zu groß

### Symptom

```
Error: bundle size exceeded maximum warning threshold
```

### Ursache

Bundle-Größe überschreitet die Limits in `angular.json`.

### Lösung

**Option 1: Limits anpassen (temporär)**

```json
// angular.json
"budgets": [
  {
    "type": "initial",
    "maximumWarning": "3mb",  // ← Erhöhen
    "maximumError": "6mb"
  }
]
```

**Option 2: Bundle-Größe reduzieren (empfohlen)**

- Lazy Loading für Features
- Ungenutzte Dependencies entfernen
- Tree-shaking optimieren

**Weitere Infos:** Siehe `ANGULAR_NETLIFY_INTEGRATION.md` → Bundle Size & Performance

---

## 🔴 Problem: Environment Variables in Production nicht verfügbar

### Symptom

```json
{
  "error": "API key not configured",
  "message": "Please set OPENAI_API_KEY in Netlify Dashboard"
}
```

### Ursache

Netlify Environment Variables nicht gesetzt.

### Lösung

**Option 1: Netlify Dashboard**

1. Gehen Sie zu: **Site Dashboard → Site configuration → Environment variables**
2. Fügen Sie hinzu:
   - `OPENAI_API_KEY` (als secret markiert)
   - `B_API_KEY` (als secret markiert)
   - `LLM_PROVIDER`

**Option 2: Netlify CLI**

```powershell
netlify env:set OPENAI_API_KEY "sk-proj-..." --secret
netlify env:set B_API_KEY "your-uuid-key" --secret
netlify env:set LLM_PROVIDER "b-api-openai"
```

**Dann: Redeploy triggern**

```powershell
# Im Netlify Dashboard
Site Dashboard → Deploys → Trigger deploy
```

---

## 🔴 Problem: Netlify Functions Timeout

### Symptom

```
Error: Function execution took longer than 10s
```

### Ursache

LLM API-Call dauert zu lange (GPT-5 Reasoning, große Prompts).

### Lösung

**Option 1: Timeout erhöhen (Pro/Business Plan)**

```toml
# netlify.toml
[functions."openai-proxy"]
  timeout = 30  # 30 Sekunden (max für Pro/Business)
```

**Option 2: Model optimieren**

```typescript
// Nutzen Sie schnellere Modelle
model: 'gpt-4.1-mini'  // Statt gpt-5
gpt5ReasoningEffort: 'minimal'  // Falls GPT-5
```

**Hinweis:** Free Plan = max 10s, Pro/Business = max 26s Background Functions

---

## 🔴 Problem: Kann Environment Variable nicht mehr sehen

### Symptom

Nach Aktivierung von "Contains secret values" ist der Key nicht mehr lesbar.

### Ursache

**Das ist gewollt!** Secrets sind write-only für Sicherheit.

### Lösung

**Kein Zugriff mehr möglich** (auch nicht für Admins).

**Wenn Sie den Key brauchen:**

1. Generieren Sie einen **neuen** Key bei Ihrem Provider
2. **Überschreiben** Sie die Variable:

```powershell
netlify env:set OPENAI_API_KEY "sk-proj-NEW-KEY" --secret
```

---

## 🔴 Problem: Lokaler Dev Server langsam

### Symptom

HMR (Hot Module Replacement) dauert lange.

### Lösung

**Option 1: Nutzen Sie `ng serve` direkt (ohne replace-env.js)**

```powershell
# Schneller, aber ohne env check
ng serve
```

**Option 2: Reduzieren Sie Bundle-Größe**

- Lazy Loading aktivieren
- Ungenutzte Imports entfernen

**Option 3: Mehr RAM für Node.js**

```json
// package.json
"start": "node --max-old-space-size=4096 replace-env.js && ng serve"
```

---

## 📋 Schnelle Diagnose-Checkliste

**Wenn etwas nicht funktioniert, prüfen Sie:**

```powershell
# ✅ Proxy läuft?
# Terminal 1 sollte zeigen: "Proxy listening on: http://localhost:3001"

# ✅ .env existiert?
Test-Path .env

# ✅ .env hat Keys?
cat .env

# ✅ Ports frei?
netstat -ano | findstr :3001
netstat -ano | findstr :4200

# ✅ Node Modules installiert?
Test-Path node_modules

# ✅ Angular läuft?
# Browser: http://localhost:4200 sollte laden
```

---

## 🔗 Weitere Hilfe

| Problem | Dokumentation |
|---------|--------------|
| Proxy/CORS | `CORS_FIX.md` |
| Secrets/API-Keys | `NETLIFY_SECRETS_CONTROLLER.md` |
| Angular + Netlify | `ANGULAR_NETLIFY_INTEGRATION.md` |
| Lokale Entwicklung | `LOCAL_DEVELOPMENT.md` |
| Deployment | `NETLIFY_DEPLOYMENT.md` |
| Alle Themen | `DOCUMENTATION_INDEX.md` |

---

## 💡 Tipps für reibungslose Entwicklung

### 1. Starten Sie immer beide Prozesse

```powershell
# Empfohlen: Nutzen Sie das Start-Script
npm run start:all

# Oder: Zwei Terminals
npm run proxy  # Terminal 1
npm start      # Terminal 2
```

### 2. Prüfen Sie .env regelmäßig

```powershell
# .env sollte existieren und Keys enthalten
cat .env
```

### 3. Nutzen Sie Netlify Dev für Production-ähnliche Umgebung

```powershell
npm run dev  # Nutzt Netlify Functions lokal
```

### 4. Halten Sie Dependencies aktuell

```powershell
npm outdated
npm update
```

---

**Stand:** Januar 2025  
**Bei weiteren Problemen:** Siehe `DOCUMENTATION_INDEX.md` oder erstellen Sie ein Issue
