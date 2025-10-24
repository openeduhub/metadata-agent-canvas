# 🚀 Deployment Quick Start

## 🎯 Wichtig: Environment Variable Priorität

**Die Platform wird gesteuert durch `DEPLOYMENT_PLATFORM` mit folgender Priorität:**

1. 🥇 **Environment Variable** (Vercel/Netlify Dashboard) - **HÖCHSTE PRIORITÄT**
2. 🥈 **`.env` File** (lokale Entwicklung) - MITTLERE PRIORITÄT
3. 🥉 **Hardcoded** (environment.prod.ts) - NUR FALLBACK

→ Environment Variables überschreiben **immer** hardcodierte Werte!

---

## 📦 Für Vercel (Environment Variable Steuerung)

### 1. Environment Variables setzen (WICHTIG!)

Im Vercel Dashboard → Settings → Environment Variables:

```
DEPLOYMENT_PLATFORM = vercel
B_API_KEY = your-uuid-key-here
LLM_PROVIDER = b-api-openai
```

⚠️ **WICHTIG:** `DEPLOYMENT_PLATFORM=vercel` ist erforderlich!

### 2. Build Settings

```
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### 3. Deploy triggern

```bash
git push origin main
```

### 4. Verifizieren (Browser Console)

```
✅ [PLATFORM DETECTION] Set via environment.ts: VERCEL
✅ [PLATFORM DETECTION] Will use: /api endpoints
```

---

## 📦 Für Netlify

### 1. Environment Variables setzen (WICHTIG!)

```bash
netlify env:set DEPLOYMENT_PLATFORM "netlify"
netlify env:set B_API_KEY "your-uuid-key-here" --secret
netlify env:set LLM_PROVIDER "b-api-openai"
```

⚠️ **WICHTIG:** `DEPLOYMENT_PLATFORM=netlify` ist erforderlich!

### 2. netlify.toml ist bereits konfiguriert

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

### 3. Deploy triggern

```bash
git push origin main
# ODER
netlify deploy --prod
```

### 4. Verifizieren (Browser Console)

```
✅ [PLATFORM DETECTION] Set via environment.ts: NETLIFY
✅ [PLATFORM DETECTION] Will use: /.netlify/functions endpoints
```

---

## 🔧 Lokale Entwicklung

```bash
# 1. Environment Variables setzen
cp .env.example .env

# 2. Editiere .env
nano .env
# Setze:
# DEPLOYMENT_PLATFORM=local
# B_API_KEY=your-uuid-key-here
# LLM_PROVIDER=b-api-openai

# 3. Proxy starten
npm run proxy

# 4. Angular Dev Server (neues Terminal)
npm start

# 5. Browser öffnen
http://localhost:4200
```

---

## ✅ Erfolgs-Checkliste

Nach Deployment prüfe:

### Browser Console (F12)

- [ ] `✅ [PLATFORM DETECTION] Set via environment.ts: VERCEL` (oder NETLIFY)
- [ ] Kein `❌` oder `⚠️` Error
- [ ] `🚀 Production: B-API-OPENAI via Vercel → /api/openai-proxy`

### Network Tab

- [ ] `POST /api/openai-proxy → 200 OK` (Vercel)
- [ ] `GET /api/geocode-proxy → 200 OK` (Vercel)
- [ ] `POST /api/repository-proxy → 200 OK` (Vercel)

ODER

- [ ] `POST /.netlify/functions/openai-proxy → 200 OK` (Netlify)
- [ ] `GET /.netlify/functions/photon → 200 OK` (Netlify)
- [ ] `POST /.netlify/functions/repository-proxy → 200 OK` (Netlify)

### Funktionalität

- [ ] Metadaten-Extraktion funktioniert
- [ ] Geocoding funktioniert
- [ ] Repository-Upload funktioniert

---

## 🐛 Häufige Probleme

### Problem: Immer noch `.netlify/functions/` auf Vercel

**Ursache:** Falscher Build-Command

**Fix:**
```
Vercel Dashboard → Settings → General
→ Build Command: npm run build:vercel
→ Redeploy
```

### Problem: 405 Method Not Allowed

**Ursache:** Falsche Endpunkte

**Fix:**
```bash
# Hard Refresh im Browser
Ctrl + Shift + R

# Falls das nicht hilft: Force Redeploy
vercel --prod --force
```

### Problem: "Unexpected end of JSON"

**Ursache:** 405 Error wird als JSON geparst

**Fix:** Siehe oben (405 Fix)

---

## 📚 Weitere Dokumentation

- **Platform Configuration:** `docs/PLATFORM_CONFIGURATION.md`
- **Vercel Deployment:** `docs/VERCEL_DEPLOYMENT.md`
- **Netlify Secrets:** `docs/NETLIFY_SECRETS_CONTROLLER.md`
- **Debug Checklist:** `VERCEL_DEBUG_CHECKLIST.md`

---

**Status:** ✅ Build-Time Platform Config implementiert  
**Empfohlener Ansatz:** Explizite Build-Commands (`build:vercel`, `build:netlify`)  
**Fallback:** Auto-Detection bei `build:prod`
