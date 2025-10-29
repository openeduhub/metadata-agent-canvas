# Deployment Guide

**Multi-Platform Deployment für Metadata Agent Canvas**

Unterstützte Plattformen: **Netlify** (empfohlen) | **Vercel**

---

## 📋 Übersicht

| Platform | Status | Secrets | Functions | Build Time | Kosten |
|----------|--------|---------|-----------|------------|--------|
| **Netlify** | ✅ Empfohlen | Secrets Controller | Netlify Functions | ~2-3 Min | Free Tier |
| **Vercel** | ✅ Unterstützt | Env Variables | Edge Functions | ~2-3 Min | Free Tier |

---

## 🚀 Netlify Deployment

### Quick Start (5 Minuten)

**1. Netlify CLI installieren:**

```bash
npm install -g netlify-cli
netlify login
```

**2. Site erstellen:**

```bash
cd webkomponente-canvas
netlify init
```

**Auswahl:**
- Create & configure a new site
- Team wählen
- Site name (z.B. `metadata-agent-canvas`)

**3. Environment Variables setzen:**

```bash
# Platform
netlify env:set DEPLOYMENT_PLATFORM "netlify"

# LLM Provider
netlify env:set LLM_PROVIDER "b-api-openai"

# API-Keys (als Secrets = write-only!)
netlify env:set OPENAI_API_KEY "sk-proj-xxxxxxxx..." --secret
netlify env:set B_API_KEY "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" --secret

# B-API Credentials
netlify env:set B_API_USERNAME "your-username"
netlify env:set B_API_PASSWORD "your-password"
netlify env:set B_API_BASE_URL "https://repository.staging.openeduhub.net"
```

**4. Deployen:**

```bash
netlify deploy --prod
```

**Fertig!** 🎉

---

### Netlify via Dashboard (Web)

**1. GitHub Repository verbinden:**

- Gehe zu https://app.netlify.com
- New site from Git
- GitHub Repository wählen

**2. Build Settings:**

```
Build command: npm run build
Publish directory: dist
```

**3. Environment Variables:**

Im Netlify Dashboard → Site Settings → Environment Variables:

| Key | Value | Type |
|-----|-------|------|
| `DEPLOYMENT_PLATFORM` | `netlify` | Normal |
| `LLM_PROVIDER` | `b-api-openai` | Normal |
| `OPENAI_API_KEY` | `sk-proj-...` | **Secret** |
| `B_API_KEY` | `uuid-key` | **Secret** |
| `B_API_USERNAME` | `your-username` | Normal |
| `B_API_PASSWORD` | `your-password` | **Secret** |
| `B_API_BASE_URL` | `https://repository...` | Normal |

**4. Secrets Controller aktivieren:**

Site Settings → Build & deploy → Environment → Secret scanning:

- ✅ Enable secret scanning
- ✅ Block builds with secrets
- ✅ Smart detection

**5. Deploy:**

Push to main branch → Auto-Deploy ✅

---

### Netlify Functions

**Verfügbare Functions:**

| Function | Endpoint | Beschreibung |
|----------|----------|--------------|
| `openai-proxy` | `/.netlify/functions/openai-proxy` | OpenAI API Proxy |
| `b-api-proxy` | `/.netlify/functions/b-api-proxy` | B-API Proxy |
| `guest-submit` | `/.netlify/functions/guest-submit` | Repository Submission |

**Features:**
- API-Keys bleiben server-side (nie im Frontend)
- CORS automatisch gehandhabt
- Environment Variables aus Netlify

**Logs ansehen:**

```bash
netlify functions:log openai-proxy
```

---

## 🔷 Vercel Deployment

### Quick Start (5 Minuten)

**1. Vercel CLI installieren:**

```bash
npm install -g vercel
vercel login
```

**2. Deployen:**

```bash
cd webkomponente-canvas
vercel
```

**Auswahl:**
- Setup and deploy
- Project name wählen
- Link to existing project? **No**

**3. Environment Variables setzen:**

Im Vercel Dashboard → Settings → Environment Variables:

```
DEPLOYMENT_PLATFORM = vercel
LLM_PROVIDER = b-api-openai
OPENAI_API_KEY = sk-proj-xxxxxxxx...
B_API_KEY = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
B_API_USERNAME = your-username
B_API_PASSWORD = your-password
B_API_BASE_URL = https://repository.staging.openeduhub.net
```

**Environment:** Production, Preview, Development (alle auswählen)

**4. Re-Deploy:**

```bash
vercel --prod
```

**Fertig!** 🎉

---

### Vercel via Dashboard (Web)

**1. GitHub Repository verbinden:**

- Gehe zu https://vercel.com
- New Project
- Import GitHub Repository

**2. Build Settings:**

```
Framework Preset: Angular
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

**3. Environment Variables:**

Im Dashboard → Settings → Environment Variables (siehe Quick Start)

**4. Deploy:**

Push to main branch → Auto-Deploy ✅

---

### Vercel Edge Functions

**Verfügbare Functions:**

| Function | Endpoint | Beschreibung |
|----------|----------|--------------|
| `openai-proxy` | `/api/openai-proxy` | OpenAI API Proxy |
| `b-api-proxy` | `/api/b-api-proxy` | B-API Proxy |
| `guest-submit` | `/api/guest-submit` | Repository Submission |

**Wichtig:** Vercel nutzt `/api/*` statt `/.netlify/functions/*`

**Logs ansehen:**

Im Vercel Dashboard → Deployments → Logs

---

## 🔧 Platform Detection

Die App erkennt automatisch die Deployment-Platform:

**Priorität:**

1. **Environment Variable** (`DEPLOYMENT_PLATFORM`) - HÖCHSTE PRIORITÄT
2. **Hostname Detection** (Runtime)
3. **Fallback:** `auto`

**Hostname-basierte Erkennung:**

```typescript
// Netlify
if (hostname.includes('netlify.app') || hostname.includes('netlify.com'))
  → platform = 'netlify'

// Vercel
if (hostname.includes('vercel.app') || hostname.includes('vercel.sh'))
  → platform = 'vercel'

// Local
if (hostname.includes('localhost'))
  → platform = 'local'
```

**Wichtig:** Setze `DEPLOYMENT_PLATFORM` immer explizit in Environment Variables!

**Weitere Infos:** [PLATFORM_DEPLOYMENT.md](./PLATFORM_DEPLOYMENT.md)

---

## 🔐 Security Checklist

### Vor Deployment

- ✅ `.env` ist in `.gitignore`
- ✅ Keine API-Keys in Git-History
- ✅ `environment.prod.ts` hat `apiKey: ''` (leer)
- ✅ Secrets als "Secret" markiert (Netlify)
- ✅ Secret Scanning aktiviert (Netlify)

### Nach Deployment

- ✅ Build Log prüfen: "No secrets found"
- ✅ Netzwerk-Tab: Keine API-Keys in Requests
- ✅ Bundle inspizieren: `grep -r "sk-proj" dist/` → NICHTS
- ✅ Functions testen: API-Calls funktionieren

**Weitere Infos:** [SECURITY_GUIDE.md](./SECURITY_GUIDE.md)

---

## 🧪 Testing nach Deployment

### 1. Basic Functionality

```bash
# Deployment URL öffnen
open https://your-app.netlify.app
# oder
open https://your-app.vercel.app
```

**Testen:**
- ✅ App lädt ohne Fehler
- ✅ Language Switcher funktioniert (DE ↔ EN)
- ✅ Content-Type Auswahl sichtbar

### 2. LLM Integration

**Testen:**
- ✅ Text eingeben
- ✅ Extraktion starten
- ✅ Felder werden gefüllt
- ✅ Keine CORS-Fehler in Console

### 3. Repository Submission

**Testen:**
- ✅ Metadaten exportieren (JSON Download)
- ✅ Submit funktioniert (falls aktiviert)
- ✅ Success/Error Messages angezeigt

---

## 📊 Monitoring & Logs

### Netlify

**Functions Logs:**

```bash
netlify functions:log openai-proxy --live
```

**Deploy Logs:**

```bash
netlify deploy:log
```

**Oder im Dashboard:**
- Functions → Function Logs
- Deploys → Deploy Log

### Vercel

**Logs im Dashboard:**
- Deployments → Deployment auswählen → Logs
- Functions → Function auswählen → Logs

**Real-time Logs:**

```bash
vercel logs <deployment-url> --follow
```

---

## 🔄 CI/CD

### Automatisches Deployment

**GitHub Actions (Netlify):**

```yaml
name: Deploy to Netlify
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: netlify/actions/cli@master
        with:
          args: deploy --prod
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

**GitHub Integration (Vercel):**

Vercel hat native GitHub Integration:
- Push → Auto-Deploy
- Pull Request → Preview Deployment
- Merge → Production Deployment

---

## 🛠️ Troubleshooting

### Build schlägt fehl

**Problem:** Build Error in Netlify/Vercel

**Lösungen:**

1. **Node Version prüfen:**
   ```bash
   # netlify.toml
   [build.environment]
     NODE_VERSION = "18"
   
   # vercel.json
   {
     "build": {
       "env": {
         "NODE_VERSION": "18"
       }
     }
   }
   ```

2. **Dependencies prüfen:**
   ```bash
   npm ci  # Nutzt package-lock.json (deterministisch)
   ```

3. **Build Command prüfen:**
   ```bash
   npm run build  # Muss funktionieren
   ```

### Functions schlagen fehl

**Problem:** 500 Internal Server Error bei API-Calls

**Lösungen:**

1. **Environment Variables prüfen:**
   ```bash
   netlify env:list  # Alle Variablen anzeigen
   ```

2. **Function Logs prüfen:**
   ```bash
   netlify functions:log openai-proxy
   ```

3. **API-Keys testen:**
   - Prüfe ob Keys gültig sind
   - Teste Keys lokal mit curl

### CORS-Fehler

**Problem:** CORS-Fehler in Browser Console

**Lösung:**

- ✅ Nutze Functions (umgehen CORS automatisch)
- ✅ Prüfe Function Endpoints:
  - Netlify: `/.netlify/functions/openai-proxy`
  - Vercel: `/api/openai-proxy`

### Platform Detection falsch

**Problem:** App nutzt falsche Endpoints

**Lösung:**

```bash
# Environment Variable explizit setzen
netlify env:set DEPLOYMENT_PLATFORM "netlify"
# oder
vercel env add DEPLOYMENT_PLATFORM
```

---

## 💰 Kosten

### Netlify Free Tier

- **300 Build-Minuten/Monat**
- **100 GB Bandwidth**
- **125k Function Requests**
- **100 GB Function Bandwidth**

**Genug für:** Kleine bis mittlere Projekte ✅

### Vercel Free Tier (Hobby)

- **100 GB Bandwidth**
- **100k Function Invocations**
- **100h Function Execution Time**

**Genug für:** Kleine bis mittlere Projekte ✅

**LLM API-Kosten extra!**

---

## 🔗 Weitere Ressourcen

### Netlify
- [Angular on Netlify](https://docs.netlify.com/frameworks/angular/)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
- [Secrets Controller](https://docs.netlify.com/environment-variables/secret-controller/)

### Vercel
- [Angular on Vercel](https://vercel.com/docs/frameworks/angular)
- [Edge Functions](https://vercel.com/docs/functions/edge-functions)
- [Environment Variables](https://vercel.com/docs/projects/environment-variables)

### Projekt-Docs
- [GETTING_STARTED.md](./GETTING_STARTED.md)
- [PLATFORM_DEPLOYMENT.md](./PLATFORM_DEPLOYMENT.md)
- [SECURITY_GUIDE.md](./SECURITY_GUIDE.md)

---

**🎉 Happy Deploying!**
