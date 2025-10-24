# 🚀 Quick Start: Netlify Secrets Controller

**Zeitaufwand:** ~5 Minuten  
**Ziel:** Sichere API-Key-Verwaltung für `webkomponente-canvas`

---

## ⚡ 3-Schritte-Setup

### 1️⃣ Lokale Entwicklung (einmalig)

```bash
cd webkomponente-canvas

# Kopieren Sie .env.example zu .env
cp .env.example .env

# Öffnen Sie .env und fügen Sie Ihre echten API-Keys ein
# OPENAI_API_KEY=sk-proj-your-actual-key
# B_API_KEY=your-uuid-key
```

**✅ Fertig!** Die `.env` Datei ist in `.gitignore` und wird nicht ins Repository committed.

---

### 2️⃣ Netlify Environment Variables (einmalig)

**Option A: Netlify Dashboard (UI)**

1. Gehen Sie zu: **Site Dashboard → Site configuration → Environment variables**
2. Klicken Sie auf **"Add a variable"** → **"Add a single variable"**
3. Fügen Sie folgende Variables hinzu:

| Key | Value | Scopes | Secret? |
|-----|-------|--------|---------|
| `OPENAI_API_KEY` | `sk-proj-your-key` | All (Production, Deploy Previews, Branch deploys) | ✅ **"Contains secret values"** aktivieren |
| `B_API_KEY` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | All | ✅ **"Contains secret values"** aktivieren |
| `LLM_PROVIDER` | `b-api-openai` | All | ❌ Kein Secret |

**Option B: Netlify CLI**

```bash
# Installieren Sie Netlify CLI (falls noch nicht vorhanden)
npm install -g netlify-cli

# Login
netlify login

# Link your site
netlify link

# Environment Variables setzen (--secret für API-Keys!)
netlify env:set OPENAI_API_KEY "sk-proj-your-actual-key" --secret
netlify env:set B_API_KEY "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" --secret
netlify env:set LLM_PROVIDER "b-api-openai"
```

**✅ Fertig!** Ihre API-Keys sind jetzt:
- **Write-only** (nie wieder lesbar)
- **Automatisch gescannt** auf Leaks
- **Sicher** vor Exposition

---

### 3️⃣ Deployment

```bash
# Lokalen Build testen
npm run build:prod

# Bundle auf Leaks prüfen (PowerShell)
Select-String -Path "dist/main*.js" -Pattern "sk-proj|bb6cdf"
# Sollte NICHTS finden!

# Linux/Mac:
grep -r "sk-proj\|bb6cdf" dist/
# Sollte NICHTS finden!

# Zu Netlify deployen
git add .
git commit -m "Setup: Netlify Secrets Controller"
git push
```

**✅ Fertig!** Netlify deployed automatisch und prüft auf Secret Leaks.

---

## 🧪 Schnelltest

### Lokal testen

```bash
# Terminal 1: Proxy starten
npm run proxy

# Terminal 2: Dev Server
npm start

# Browser öffnen: http://localhost:4200
# Metadata-Extraktion testen → Sollte funktionieren
```

### Production testen

Nach Deployment:
1. **Öffnen Sie Ihre deployed Site**
2. **Testen Sie Metadata-Extraktion**
3. **Developer Tools → Sources**
4. **Suchen Sie im Bundle nach `sk-proj`** → Sollte **NICHTS** finden!

---

## 📋 Deployment Checklist (Copy-Paste)

Vor jedem Production Push:

```bash
# ✅ Lokale .env existiert (nicht in Git)
test -f .env && echo "✅ .env exists" || echo "❌ .env missing"

# ✅ .env ist in .gitignore
git check-ignore .env && echo "✅ .env ignored" || echo "❌ .env NOT ignored"

# ✅ environment.prod.ts hat keine Keys
! grep -q "sk-proj\|bb6cdf" src/environments/environment.prod.ts && echo "✅ No keys in environment.prod.ts" || echo "❌ KEYS FOUND!"

# ✅ Build testen
npm run build:prod

# ✅ Bundle auf Leaks prüfen
! grep -r "sk-proj\|bb6cdf" dist/ && echo "✅ No keys in bundle" || echo "❌ KEYS IN BUNDLE!"
```

**Alle ✅? Dann sind Sie ready für Production!**

---

## ❌ Häufige Fehler

### "API key not configured" in Production

**Problem:** Environment Variable nicht gesetzt.

**Fix:**
```bash
netlify env:set OPENAI_API_KEY "sk-proj-your-key" --secret
# Dann: Site Dashboard → Deploys → Trigger deploy
```

### Build schlägt fehl: "Secret detected"

**Problem:** API-Key wurde in Code/Bundle injiziert.

**Fix:**
```typescript
// src/environments/environment.prod.ts
openai: {
  apiKey: '', // ← Muss leer sein!
}
```

### Lokaler Proxy: "Failed to fetch"

**Problem:** Proxy läuft nicht.

**Fix:**
```bash
# Terminal 1: Proxy starten
npm run proxy
```

---

## 🔗 Weiterführende Dokumentation

- **Vollständige Anleitung:** `NETLIFY_SECRETS_CONTROLLER.md`
- **Sicherheitsarchitektur:** `SECURITY_ARCHITECTURE.md`
- **Environment Variables:** `ENVIRONMENT_VARIABLES.md`
- **Netlify Deployment:** `NETLIFY_DEPLOYMENT.md`

---

## 💡 Pro-Tipps

### Development nur mit B-API

Wenn Sie nur B-API nutzen (kein OpenAI):

```bash
# .env (lokal)
LLM_PROVIDER=b-api-openai
B_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Netlify Dashboard
B_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (as secret)
LLM_PROVIDER=b-api-openai
```

`OPENAI_API_KEY` kann leer bleiben!

### Dev Context für lokale Tests

Für `netlify dev` können Sie einen separaten `dev` Context nutzen:

```bash
# Dev-Context mit dummy key (bleibt lesbar)
netlify env:set OPENAI_API_KEY "sk-test-dummy-key" --context dev

# Production mit echtem key (write-only)
netlify env:set OPENAI_API_KEY "sk-proj-real-key" --secret --context production
```

### Secret Scanning anpassen

Falls False Positives gefunden werden:

```bash
# Im Netlify Dashboard
Key: SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES
Value: not-a-real-secret,test-data-string
```

---

**Stand:** Januar 2025  
**Für Fragen:** Siehe `NETLIFY_SECRETS_CONTROLLER.md`
