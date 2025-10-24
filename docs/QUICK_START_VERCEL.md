# ⚡ Vercel Quick Start

## 🎯 In 5 Minuten auf Vercel deployen

### 1️⃣ Vercel Account & CLI

```bash
# Vercel CLI installieren
npm i -g vercel

# Login
vercel login
```

### 2️⃣ Build & Deploy

```bash
cd c:\Users\jan\staging\Windsurf\metadata-agent\webkomponente-canvas

# Build
npm run build

# Deploy
vercel --prod
```

### 3️⃣ Environment Variables setzen

Im Vercel Dashboard (https://vercel.com/dashboard):

1. Dein Projekt auswählen
2. **Settings** → **Environment Variables**
3. Hinzufügen:

| Variable | Wert |
|----------|------|
| `B_API_KEY` | `dein-b-api-key` |
| `LLM_PROVIDER` | `b-api-openai` |

4. **Save** klicken
5. **Redeploy** auslösen

---

## ✅ Test nach Deployment

Öffne: `https://deine-app.vercel.app/`

**Console sollte zeigen:**
```
▲ Platform: Vercel
🚀 Production: B-API-OPENAI via Vercel → /api/openai-proxy
```

---

## 🔧 Was wurde geändert?

### Neue Dateien

✅ `/api/openai-proxy.js` - Vercel API Route für LLM  
✅ `/api/geocode-proxy.js` - Vercel API Route für Geocoding  
✅ `/vercel.json` - Vercel Konfiguration  
✅ `/src/app/services/platform-detection.service.ts` - Auto-Detection  

### Angepasste Dateien

✅ `openai-proxy.service.ts` - Nutzt Platform-Detection  
✅ `geocoding.service.ts` - Nutzt Platform-Detection  

### Kompatibilität

✅ **Netlify** funktioniert weiterhin genau wie vorher!  
✅ **Vercel** funktioniert mit denselben Dateien!  
✅ **Lokal** funktioniert unverändert!

---

## 🎉 Fertig!

Die App funktioniert jetzt auf **beiden** Plattformen automatisch.

**Netlify:** `/.netlify/functions/openai-proxy`  
**Vercel:** `/api/openai-proxy`

Kein Code-Wechsel nötig! 🚀
