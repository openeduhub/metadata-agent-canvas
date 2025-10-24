# 🚀 Vercel Deployment Guide

Die Canvas-Webkomponente ist jetzt **Universal** und funktioniert auf **Netlify UND Vercel**!

## ✨ Features

- ✅ **Automatische Platform-Detection** - Erkennt ob Netlify oder Vercel
- ✅ **Dual-Compatible API Routes** - `/api/*` (Vercel) und `/.netlify/functions/*` (Netlify)
- ✅ **Keine Code-Änderungen** nötig beim Wechsel zwischen Plattformen
- ✅ **Lokale Entwicklung** funktioniert wie gewohnt

---

## 📦 Struktur

```
webkomponente-canvas/
├── api/                          # Vercel API Routes
│   ├── openai-proxy.js          # LLM Proxy (OpenAI, B-API)
│   ├── geocode-proxy.js         # Geocoding Proxy (Photon)
│   └── repository-proxy.js      # edu-sharing Repository API
├── netlify/functions/            # Netlify Functions
│   ├── openai-proxy.js          # Identische Logik wie Vercel
│   ├── photon.js                # Geocoding (Photon API)
│   └── repository-proxy.js      # Identische Logik wie Vercel
├── src/app/services/
│   └── platform-detection.service.ts  # Auto-Detection Service
├── vercel.json                   # Vercel Konfiguration
└── netlify.toml                  # Netlify Konfiguration
```

---

## 🎯 Vercel Deployment

### Option 1: Vercel CLI

```bash
# Vercel CLI installieren (falls noch nicht)
npm i -g vercel

# Build erstellen
npm run build

# Deployen
vercel --prod
```

### Option 2: Vercel Dashboard (EMPFOHLEN)

1. Zu https://vercel.com/ gehen
2. **"Import Project"** klicken
3. GitHub Repository verknüpfen
4. **Framework Preset:** "Other" (Angular)
5. **Build Command:** `npm run build:vercel` ⚠️ WICHTIG: Nicht `build:prod`!
6. **Output Directory:** `dist`
7. **Install Command:** `npm install`

**Warum `build:vercel`?**
- ✅ Setzt `deploymentPlatform: 'vercel'` explizit
- ✅ Keine Runtime-Detection nötig
- ✅ Garantiert korrekte `/api/*` Endpunkte

---

## ⚙️ Environment Variables (Vercel)

Im Vercel Dashboard → **Settings → Environment Variables**:

| Variable | Wert | Beschreibung |
|----------|------|--------------|
| `OPENAI_API_KEY` | `sk-proj-...` | OpenAI API Key (optional) |
| `B_API_KEY` | `uuid-...` | B-API Key für OpenAI-kompatibel |
| `LLM_PROVIDER` | `b-api-openai` | Provider-Auswahl |
| `NODE_ENV` | `production` | Environment |

**Wichtig:** Markiere API Keys als **"Sensitive"** in Vercel!

---

## 🧪 Testen nach Deployment

### 1. Platform-Detection prüfen

Öffne die Console (F12) nach dem Deployment:

```
▲ Platform: Vercel
🚀 Production: B-API-OPENAI via Vercel → /api/openai-proxy
```

### 2. LLM Proxy testen

```bash
curl -X POST https://your-app.vercel.app/api/openai-proxy \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Test"}],
    "model": "gpt-4o-mini",
    "provider": "b-api-openai"
  }'
```

**Erwartetes Ergebnis:** LLM-Antwort (Status 200)

### 3. Full Integration testen

1. Canvas öffnen: `https://your-app.vercel.app/`
2. Text eingeben → "Generate" klicken
3. Console prüfen:
   - ✅ Platform: Vercel
   - ✅ Proxy-URL: `/api/openai-proxy`
   - ✅ Felder werden extrahiert

---

## 🔄 Netlify bleibt funktionsfähig!

Dasselbe Projekt funktioniert weiterhin auf Netlify:

```bash
# Netlify Deploy
netlify deploy --prod
```

**Console Output:**
```
◆ Platform: Netlify
🚀 Production: B-API-OPENAI via Netlify → /.netlify/functions/openai-proxy
```

---

## 🐛 Troubleshooting

### ❌ "Platform: Unknown"
**Problem:** Platform-Detection schlägt fehl  
**Lösung:** Checke Hostname in Console, füge ggf. Custom Domain zu Detection hinzu

### ❌ "API key not configured"
**Problem:** Environment Variables nicht gesetzt  
**Lösung:** 
1. Vercel Dashboard → Settings → Environment Variables
2. Füge `B_API_KEY` oder `OPENAI_API_KEY` hinzu
3. Redeploy mit `vercel --prod`

### ❌ "404 Not Found" bei API Routes
**Problem:** `vercel.json` fehlt oder falsch konfiguriert  
**Lösung:** Prüfe dass `vercel.json` im Root liegt und korrekt ist

### ❌ Build schlägt fehl
**Problem:** Dependencies fehlen oder falsche Node-Version  
**Lösung:**
```bash
# Lokal testen
npm run build

# Node-Version prüfen (sollte >= 18)
node --version
```

---

## 📊 Vergleich Netlify vs Vercel

| Feature | Netlify | Vercel |
|---------|---------|--------|
| **Functions** | `/.netlify/functions/*` | `/api/*` |
| **Build Command** | `npm run build` | `npm run build` |
| **Output Dir** | `dist` | `dist` |
| **Auto-Deploy** | ✅ GitHub Integration | ✅ GitHub Integration |
| **Environment Vars** | Dashboard → Site Settings | Dashboard → Settings |
| **Free Tier** | 300 Build Minutes | Unlimited |
| **Cold Start** | ~1s | ~500ms |

---

## 🎉 Vorteile der Universal-Lösung

- **Kein Vendor Lock-in** - Wechsel zwischen Plattformen ohne Code-Änderung
- **Kostenoptimierung** - Nutze Free-Tiers beider Plattformen
- **Redundanz** - Failover zwischen Plattformen möglich
- **Flexibilität** - Teste Features auf einer Platform, deploye auf der anderen

---

## 📝 Deployment-Checklist

### Vercel First-Time Setup

- [ ] Vercel Account erstellen
- [ ] GitHub Repository verknüpfen
- [ ] Build Settings konfigurieren
- [ ] Environment Variables setzen
- [ ] First Deploy: `vercel --prod`
- [ ] Custom Domain (optional) hinzufügen
- [ ] Platform-Detection in Console prüfen
- [ ] LLM Proxy testen
- [ ] Canvas Full Integration testen

### Netlify (bleibt unverändert)

- [ ] Weiterhin funktionsfähig
- [ ] Keine Änderungen nötig
- [ ] Dual-Deployment möglich

---

## 🔗 Nützliche Links

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Vercel Docs:** https://vercel.com/docs
- **Vercel CLI:** https://vercel.com/docs/cli
- **Angular on Vercel:** https://vercel.com/guides/deploying-angular-with-vercel

---

## 💡 Pro-Tips

1. **Dual-Deployment:** Deploye auf beide Plattformen für Redundanz
2. **Custom Domains:** Nutze z.B. `canvas.example.com` (Vercel) und `canvas-staging.example.com` (Netlify)
3. **Environment-specific Configs:** Nutze Vercel/Netlify Preview Deployments für Feature-Testing
4. **Monitoring:** Aktiviere Vercel Analytics für Performance-Insights

---

**Status:** ✅ Universal-Deployment funktioniert!  
**Letztes Update:** 2025-01-19
