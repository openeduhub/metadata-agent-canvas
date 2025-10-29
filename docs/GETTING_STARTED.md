# Getting Started

**Schnellstart-Guide für Metadata Agent Canvas Edition**

---

## 📋 Voraussetzungen

- **Node.js** 18+ und npm
- **Git**
- **API-Key** für LLM-Provider (OpenAI oder B-API)
- *Optional:* Netlify CLI oder Vercel CLI

---

## ⚡ Quick Start (5 Minuten)

### 1. Repository klonen

```bash
git clone <repository-url>
cd webkomponente-canvas
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Environment konfigurieren

Kopiere das Template und füge deine API-Keys ein:

```bash
cp .env.template .env
```

**Editiere `.env`:**

```bash
# LLM Provider (b-api-openai, b-api-academic-cloud, oder openai)
LLM_PROVIDER=b-api-openai

# B-API Credentials
B_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
B_API_BASE_URL=https://repository.staging.openeduhub.net
B_API_USERNAME=your-username
B_API_PASSWORD=your-password

# ODER OpenAI (falls du OpenAI direkt nutzen möchtest)
OPENAI_API_KEY=sk-proj-xxxxxxxx...

# Platform (local für Entwicklung)
DEPLOYMENT_PLATFORM=local
```

### 4. Entwicklungsserver starten

```bash
npm start
```

App läuft auf **http://localhost:4200** 🎉

---

## 🔧 Lokale Entwicklung

### Development Server

```bash
npm start
# oder
ng serve
```

**Features:**
- Live Reload bei Code-Änderungen
- Angular DevTools Integration
- Source Maps für Debugging

### Mit Netlify Dev (empfohlen für Functions)

```bash
npm install -g netlify-cli
netlify dev
```

**Vorteile:**
- Netlify Functions lokal testen
- Environment Variables aus Netlify laden
- Gleiche Umgebung wie Production

---

## 🌐 Deployment

### Netlify (empfohlen)

**1. Netlify CLI installieren:**

```bash
npm install -g netlify-cli
netlify login
```

**2. Site erstellen:**

```bash
netlify init
```

**3. Environment Variables setzen:**

```bash
# API-Keys als Secrets (write-only)
netlify env:set OPENAI_API_KEY "sk-proj-..." --secret
netlify env:set B_API_KEY "your-uuid-key" --secret

# LLM Provider
netlify env:set LLM_PROVIDER "b-api-openai"

# Platform
netlify env:set DEPLOYMENT_PLATFORM "netlify"

# B-API Credentials
netlify env:set B_API_USERNAME "your-username"
netlify env:set B_API_PASSWORD "your-password"
netlify env:set B_API_BASE_URL "https://repository.staging.openeduhub.net"
```

**4. Deployen:**

```bash
netlify deploy --prod
```

**Weitere Infos:** Siehe [DEPLOYMENT.md](./DEPLOYMENT.md)

---

### Vercel

**1. Vercel CLI installieren:**

```bash
npm install -g vercel
vercel login
```

**2. Deployen:**

```bash
vercel
```

**3. Environment Variables setzen:**

Im Vercel Dashboard → Settings → Environment Variables:

```
DEPLOYMENT_PLATFORM = vercel
LLM_PROVIDER = b-api-openai
B_API_KEY = your-uuid-key
OPENAI_API_KEY = sk-proj-...
```

**Weitere Infos:** Siehe [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 🔐 Sicherheit

### API-Keys

**❌ NIEMALS:**
- API-Keys in Git committen
- API-Keys in Frontend-Code hardcoden
- API-Keys in environment.ts/prod.ts eintragen

**✅ IMMER:**
- `.env` für lokale Entwicklung nutzen
- Environment Variables für Deployment
- Secrets als "write-only" markieren (Netlify)
- API-Keys server-side (Netlify Functions)

### Secrets Controller (Netlify)

Netlify scannt automatisch vor jedem Build nach geleakten Secrets:

```bash
# Build Log:
✓ Secret scanning: No secrets found
```

Falls Secrets gefunden werden → **Build fails** (verhindert Deployment)

**Weitere Infos:** Siehe [SECURITY_GUIDE.md](./SECURITY_GUIDE.md)

---

## 📚 Wichtige Dateien

| Datei/Ordner | Beschreibung |
|--------------|--------------|
| `src/` | Angular Source Code |
| `src/environments/` | Environment Konfiguration |
| `src/schemata/` | Schema-Definitionen (JSON) |
| `src/assets/i18n/` | Übersetzungsdateien (DE/EN) |
| `netlify/functions/` | Netlify Functions (Proxies) |
| `.env` | Lokale Environment Variables (nicht committet) |
| `.env.template` | Template für `.env` |
| `netlify.toml` | Netlify Build Configuration |

---

## 🎯 Nächste Schritte

### Features erkunden

1. **Content-Type wählen** - Event, Course, Learning Material, etc.
2. **Text einfügen** - URL oder direkter Text
3. **Extraktion starten** - KI extrahiert Metadaten
4. **Felder bearbeiten** - Inline-Editing im Canvas
5. **Sprache wechseln** - Language Switcher (🇩🇪 / 🇬🇧)
6. **JSON exportieren** - Download oder direkt ins Repository

### Dokumentation lesen

- **[FEATURES.md](./FEATURES.md)** - Alle Features im Detail
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Entwickler-Guide
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment-Optionen
- **[INTERNATIONALIZATION.md](./INTERNATIONALIZATION.md)** - i18n-System
- **[SCHEMA_I18N.md](./SCHEMA_I18N.md)** - Schema-Struktur

---

## ❓ Troubleshooting

### App startet nicht

**Problem:** `npm start` schlägt fehl

**Lösung:**
```bash
# Node Modules neu installieren
rm -rf node_modules package-lock.json
npm install
```

### API-Calls schlagen fehl

**Problem:** 401 Unauthorized / 403 Forbidden

**Lösung:**
- Prüfe API-Keys in `.env`
- Stelle sicher dass Provider korrekt ist (`LLM_PROVIDER`)
- Prüfe B-API Credentials (Username/Password)

### CORS-Fehler

**Problem:** CORS-Fehler in Browser Console

**Lösung:**
- Nutze Netlify Functions/Vercel Edge Functions (umgehen CORS)
- Für lokale Entwicklung: `netlify dev` statt `ng serve`

### Secrets werden geleakt

**Problem:** Netlify Build schlägt fehl mit "Secret found"

**Lösung:**
- Prüfe `environment.prod.ts` → `apiKey: ''` (muss leer sein)
- Entferne alle hardcoded Keys aus Code
- Nutze `--secret` Flag bei `netlify env:set`

**Weitere Infos:** Siehe [CORS_FIX.md](./CORS_FIX.md)

---

## 💡 Tipps

### Produktivität

- **Nutze `netlify dev`** für realistische lokale Umgebung
- **Language Switcher** testen (DE ↔ EN)
- **DevTools** öffnen für Performance-Monitoring
- **Schema-Definitionen** in `src/schemata/` anpassen

### Testing

- Teste mit verschiedenen Content-Types
- Prüfe Vokabular-Matching (Fuzzy-Matching)
- Teste verschachtelte Felder (Location, Address)
- Wechsle Sprache während Extraktion

---

## 📞 Support

**Dokumentation:**
- Siehe `docs/DOCUMENTATION_INDEX.md` für vollständige Übersicht
- Alle Guides sind in `docs/` verfügbar

**Issues:**
- GitHub Issues für Bug-Reports
- Pull Requests willkommen

---

**🎉 Viel Erfolg mit Metadata Agent Canvas Edition!**
