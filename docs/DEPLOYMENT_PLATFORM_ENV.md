# 🎯 Deployment Platform Configuration via Environment Variable

## 📋 Übersicht

Die Deployment-Platform wird über die **Environment Variable `DEPLOYMENT_PLATFORM`** gesteuert. Das ermöglicht:

✅ **Single Repository** für Netlify UND Vercel  
✅ **Keine Code-Änderungen** zwischen Deployments  
✅ **Lokale Steuerung** über `.env`  
✅ **Cloud-Steuerung** über Platform Environment Variables  

## 🔧 Environment Variable

### Variable: `DEPLOYMENT_PLATFORM`

**Mögliche Werte:**

| Wert | Bedeutung | API Endpunkte | Use Case |
|------|-----------|---------------|----------|
| `vercel` | Vercel Deployment | `/api/*` | Vercel Production |
| `netlify` | Netlify Deployment | `/.netlify/functions/*` | Netlify Production |
| `local` | Local Development | `http://localhost:3001/*` | Lokale Entwicklung |
| `auto` | Auto-Detection | Hostname-basiert | Fallback/Generic |

**Default:** `auto` (wenn nicht gesetzt)

## 🏠 Lokale Entwicklung (.env)

### 1. `.env` erstellen/editieren

```bash
# Kopiere Template
cp .env.example .env

# Editiere .env
nano .env
```

### 2. Platform setzen

```bash
# Für lokale Entwicklung
DEPLOYMENT_PLATFORM=local

# Für lokales Testen der Vercel-Config
DEPLOYMENT_PLATFORM=vercel

# Für lokales Testen der Netlify-Config
DEPLOYMENT_PLATFORM=netlify
```

### 3. Build testen

```bash
npm run build
```

**Erwartete Ausgabe:**
```
═══════════════════════════════════════════════════════
🏗️  Smart Build Script - Platform-Aware
═══════════════════════════════════════════════════════
📦 DEPLOYMENT_PLATFORM: local
✅ Using Local configuration → http://localhost:3001/* endpoints
🔨 Running: ng build --configuration development
```

## ☁️ Vercel Deployment

### 1. Environment Variable setzen

**Vercel Dashboard → Settings → Environment Variables:**

```
Name:  DEPLOYMENT_PLATFORM
Value: vercel
```

**Für alle Environments** (Production, Preview, Development)

### 2. Build Settings

**Vercel Dashboard → Settings → General:**

```
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### 3. Deployment

```bash
git push origin main
```

**Build-Log wird zeigen:**
```
📦 DEPLOYMENT_PLATFORM: vercel
✅ Using Vercel configuration → /api/* endpoints
```

## ☁️ Netlify Deployment

### 1. Environment Variable setzen

**Option A: Netlify Dashboard**

Settings → Build & Deploy → Environment:

```
Key:   DEPLOYMENT_PLATFORM
Value: netlify
```

**Option B: Netlify CLI**

```bash
netlify env:set DEPLOYMENT_PLATFORM netlify
```

### 2. Build Settings (netlify.toml)

Bereits konfiguriert:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

### 3. Deployment

```bash
git push origin main
# ODER
netlify deploy --prod
```

**Build-Log wird zeigen:**
```
📦 DEPLOYMENT_PLATFORM: netlify
✅ Using Netlify configuration → /.netlify/functions/* endpoints
```

## 🔍 Verifikation

### Nach Deployment prüfen (Browser Console):

**Vercel:**
```
✅ [PLATFORM DETECTION] Set via environment.ts: VERCEL
✅ [PLATFORM DETECTION] Will use: /api endpoints
```

**Netlify:**
```
✅ [PLATFORM DETECTION] Set via environment.ts: NETLIFY
✅ [PLATFORM DETECTION] Will use: /.netlify/functions endpoints
```

**Auto-Detect (falls DEPLOYMENT_PLATFORM nicht gesetzt):**
```
🔍 [PLATFORM DETECTION] Environment: auto-detect
🔍 [PLATFORM DETECTION] Hostname: your-domain.com
✅ [PLATFORM DETECTION] Detected: VERCEL (hostname)
```

## 🎭 Multi-Environment Setup

### Unterschiedliche Environments auf derselben Platform

**Vercel:**
```
Production:  DEPLOYMENT_PLATFORM=vercel
Preview:     DEPLOYMENT_PLATFORM=vercel
Development: DEPLOYMENT_PLATFORM=vercel
```

**Netlify:**
```
Production:       DEPLOYMENT_PLATFORM=netlify
Deploy Previews:  DEPLOYMENT_PLATFORM=netlify
Branch Deploys:   DEPLOYMENT_PLATFORM=netlify
```

## 🔄 Workflow-Beispiele

### Szenario 1: Lokale Entwicklung

```bash
# .env
DEPLOYMENT_PLATFORM=local

# Terminal 1: Proxy starten
npm run proxy

# Terminal 2: Angular Dev Server
npm start
```

### Szenario 2: Lokales Testen der Vercel-Config

```bash
# .env
DEPLOYMENT_PLATFORM=vercel

# Build
npm run build

# Serve (ohne Proxy, nutzt /api/* Routes die 404 werfen)
npx serve dist
```

### Szenario 3: Dual-Deployment (Same Repo, Both Platforms)

**Main Branch → Vercel:**
```
Vercel: Deploy from main
DEPLOYMENT_PLATFORM=vercel
```

**Main Branch → Netlify:**
```
Netlify: Deploy from main
DEPLOYMENT_PLATFORM=netlify
```

Beide nutzen **dasselbe Repository**, **denselben Branch**, unterscheiden sich nur durch die Environment Variable!

## 📊 Build-Script Logik

```javascript
// build-with-platform.js
const platform = process.env.DEPLOYMENT_PLATFORM || 'auto';

switch (platform) {
  case 'vercel':   → ng build --configuration vercel
  case 'netlify':  → ng build --configuration netlify
  case 'local':    → ng build --configuration development
  case 'auto':     → ng build --configuration production (auto-detect)
}
```

## 🐛 Troubleshooting

### Problem: Build nutzt falsche Platform

**Symptom:**
```
📦 DEPLOYMENT_PLATFORM: auto
✅ Using Auto-detect configuration
```

**Ursache:** Environment Variable nicht gesetzt

**Fix:**
```bash
# Vercel Dashboard: Prüfe Environment Variables
# Netlify CLI:
netlify env:list

# Sollte zeigen:
DEPLOYMENT_PLATFORM = netlify
```

### Problem: Lokaler Build ignoriert .env

**Ursache:** `.env` nicht im Root oder Syntax-Fehler

**Fix:**
```bash
# Prüfe ob .env existiert
ls -la .env

# Prüfe Syntax (keine Spaces um =)
cat .env | grep DEPLOYMENT_PLATFORM
# Richtig: DEPLOYMENT_PLATFORM=vercel
# Falsch:  DEPLOYMENT_PLATFORM = vercel
```

### Problem: Console zeigt falsche Platform nach Deployment

**Ursache:** Build-Cache oder Environment Variable nicht übernommen

**Fix:**
```bash
# Vercel: Force Redeploy
vercel --prod --force

# Netlify: Clear Cache & Redeploy
netlify build --clear-cache
netlify deploy --prod
```

## ✅ Best Practices

### 1. Setze DEPLOYMENT_PLATFORM explizit

```bash
# NICHT empfohlen (auto-detect)
# Keine Environment Variable

# EMPFOHLEN (explizit)
DEPLOYMENT_PLATFORM=vercel  # auf Vercel
DEPLOYMENT_PLATFORM=netlify # auf Netlify
```

### 2. Dokumentiere in README

```markdown
## Deployment

Vercel: Set `DEPLOYMENT_PLATFORM=vercel`
Netlify: Set `DEPLOYMENT_PLATFORM=netlify`
```

### 3. Prüfe Build-Logs

```bash
# Sollte immer zeigen:
📦 DEPLOYMENT_PLATFORM: <platform>
✅ Using <Platform> configuration
```

### 4. Teste lokal vor Deployment

```bash
# Setze Platform in .env
DEPLOYMENT_PLATFORM=vercel

# Build
npm run build

# Prüfe was gebaut wurde
grep deploymentPlatform dist/main.*.js
# Sollte: "vercel" zeigen
```

## 📚 Zusammenfassung

| Location | Steuerung | Priorität |
|----------|-----------|-----------|
| **Lokal** | `.env` File | 🥇 |
| **Vercel** | Environment Variables (Dashboard) | 🥇 |
| **Netlify** | Environment Variables (Dashboard/CLI) | 🥇 |
| **Fallback** | Auto-detect (hostname) | 🥉 |

**Single Repository, Multiple Deployments:**
- ✅ Gleicher Code
- ✅ Gleicher Branch
- ✅ Unterschiedliche Platform via Environment Variable
- ✅ Keine Code-Änderungen nötig

---

**Status:** ✅ Environment-Variable-Steuerung implementiert  
**Empfehlung:** Setze `DEPLOYMENT_PLATFORM` explizit auf allen Platforms  
**Datum:** 2025-01-19
