# 🔐 Security Architecture: API Keys Server-Side Only

## ⚠️ Critical Security Principle

**API-Keys dürfen NIEMALS in Frontend-Code (Angular Bundle) landen!**

Alles, was in `environment.ts` steht, wird beim Build in `main.js` kompiliert und ist für jeden im Browser sichtbar. Deshalb:

✅ **API-Keys bleiben server-side** (Netlify Functions / lokaler Proxy)  
❌ **Keine Keys in `environment.ts` oder `environment.prod.ts`**  
❌ **Kein Key-Injection via `replace-env.js`**

---

## 🏗️ Architektur

```
┌─────────────────┐
│  Angular App    │  ← Keine API-Keys!
│  (localhost:420)│
└────────┬────────┘
         │ HTTP Request (ohne Key)
         ├─────────────────────────────────┐
         │                                 │
    Development                      Production
         │                                 │
┌────────▼────────┐              ┌─────────▼─────────┐
│ universal-proxy │              │ Netlify Functions │
│ (localhost:3001)│              │ /.netlify/funcs/* │
└────────┬────────┘              └─────────┬─────────┘
         │                                 │
         │ Keys aus .env                   │ Keys aus Netlify Env Vars
         ├─────────────────────────────────┤
         │                                 │
┌────────▼─────────────────────────────────▼────────┐
│  Externe APIs (OpenAI, B-API, Photon, Repository) │
└────────────────────────────────────────────────────┘
```

---

## 💻 Lokale Entwicklung

### 1. API-Keys und Provider in `.env` ablegen (nicht committen!)

```bash
# .env (Projekt-Root oder webkomponente-canvas/)
# LLM Provider auswählen
LLM_PROVIDER=b-api-openai  # Optionen: openai, b-api-openai, b-api-academiccloud

# API Keys (je nach Provider)
B_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  # Für b-api-openai / b-api-academiccloud
OPENAI_API_KEY=sk-proj-...  # Für openai provider
```

**Wichtig:** `.env` ist in `.gitignore` – wird NICHT ins Repository committed!

#### Provider-Optionen:

| Provider | Benötigt | Model | Verwendung |
|----------|----------|-------|------------|
| `b-api-openai` | `B_API_KEY` | `gpt-4.1-mini` | B-API OpenAI-kompatibel (Standard) |
| `b-api-academiccloud` | `B_API_KEY` | `deepseek-r1` | B-API mit DeepSeek-R1 |
| `openai` | `OPENAI_API_KEY` | `gpt-4.1-mini` | Direkt OpenAI API |

### 2. Universal Proxy starten

```bash
# Terminal 1
npm run proxy
```

Der Proxy läuft auf `http://localhost:3001` und:
- Liest Keys aus `.env`
- Stellt Endpunkte bereit: `/llm`, `/geocoding`, `/repository`
- Fügt CORS-Header hinzu

### 3. Angular starten

```bash
# Terminal 2
npm start
```

Angular läuft auf `http://localhost:4200` und sendet Requests **ohne Keys** an `http://localhost:3001/*`.

---

## 🚀 Production (Netlify)

**Wichtig:** `.env` Dateien werden **NICHT** ins Repository committed! Netlify liest Environment Variables aus dem Dashboard.

### 1. Environment Variables in Netlify Dashboard setzen

Gehen Sie zu: **Site Settings → Environment Variables** oder nutzen Sie die CLI:

**Dashboard:**
```
Key: B_API_KEY
Value: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Scopes: All scopes

Key: LLM_PROVIDER (Optional)
Value: b-api-openai
Options: openai, b-api-openai, b-api-academiccloud

Key: OPENAI_API_KEY (falls OpenAI direkt genutzt wird)
Value: sk-proj-...
```

**CLI:**
```bash
netlify env:set B_API_KEY "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
netlify env:set LLM_PROVIDER "b-api-openai"
netlify env:set OPENAI_API_KEY "sk-proj-..."
```

📖 **Vollständiger Deployment-Guide:** Siehe `NETLIFY_DEPLOYMENT.md`

### 🔐 Secrets Controller (EMPFOHLEN - JETZT AKTIV!)

**✅ Secrets Controller ist aktiviert** für alle API-Keys in diesem Projekt!

Aktivieren Sie **"Contains secret values"** für alle API-Keys im Netlify Dashboard:

**Vorteile:**
- ✅ **Write-only:** Keys sind nach Speichern nie wieder lesbar (auch nicht im Dashboard)
- ✅ **Secret Scanning:** Automatische Prüfung auf Leaks in Code & Bundles vor jedem Deploy
- ✅ **Smart Detection:** Erkennt auch nicht-markierte Secrets automatisch
- ✅ **Build schlägt fehl** bei gefundenen Secrets → verhindert Leaks proaktiv
- ✅ **Multi-Format-Scan:** Sucht plaintext, base64, URI-encoded Versionen
- ✅ **No post-processing:** Verhindert versehentliche Snippet-Injection mit Secrets

**Ohne** Secrets Controller: Keys sind lesbar, kein automatisches Scanning, höheres Risiko!

📖 **Vollständiger Guide:** Siehe `NETLIFY_SECRETS_CONTROLLER.md`  
🚀 **Quick Start:** Siehe `QUICKSTART_NETLIFY_SECRETS.md`

### 2. Netlify Functions

Die Proxies liegen in `netlify/functions/`:

```
netlify/functions/
├── openai-proxy.js      ← LLM Requests (OpenAI, B-API)
├── photon.js            ← Geocoding (Photon API)
└── repository-proxy.js  ← Repository API (edu-sharing)
```

Diese lesen Keys aus `process.env` (Netlify Environment Variables) und sind **nie im Angular-Bundle**.

### 3. URLs in Production

```typescript
// environment.prod.ts
proxyUrl: '' // Leer lassen → Fallback: /.netlify/functions/openai-proxy
```

Angular ruft automatisch `/.netlify/functions/openai-proxy` auf.

---

## 🔍 Was wurde geändert?

### 1. `environment.ts` – Alle Keys entfernt

```typescript
// ❌ VORHER (UNSICHER!)
apiKey: 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'

// ✅ NACHHER (SICHER)
apiKey: '', // NOT USED - API key is kept server-side for security
```

### 2. `replace-env.js` – Key-Injection deaktiviert

```javascript
// SECURITY: Never inject API keys into frontend code
if (false) { // Disabled for security
  content = content.replace(...); // Key-Ersetzung deaktiviert
}
```

### 3. `openai-proxy.service.ts` – Direktzugriff deaktiviert

```typescript
// SECURITY: Always use proxy to keep API keys server-side
this.useDirectAccess = false;
```

Alle LLM-Requests gehen jetzt über den Proxy (lokal oder Netlify Functions).

---

## ✅ Sicherheitschecks

### Lokal testen:

```bash
# 1. .env existiert und ist in .gitignore
cat .env  # Sollte Keys enthalten
git status .env  # Sollte NICHT gelistet sein

# 2. environment.ts hat keine Keys
grep "apiKey.*sk-proj" src/environments/environment.ts  # Sollte LEER sein

# 3. Bundle prüfen
npm start
# Browser DevTools → Sources → main.js durchsuchen nach "sk-proj" oder "bb6cdf"
# Sollte NICHT gefunden werden!
```

### Production testen:

```bash
# 1. Netlify Environment Variables gesetzt?
# Dashboard → Site Settings → Environment variables
# B_API_KEY und OPENAI_API_KEY müssen dort stehen

# 2. Deployed Bundle prüfen
# In Production: Browser DevTools → Sources → main.js durchsuchen
# Sollte KEINE Keys enthalten!
```

---

## 📋 Deployment Checklist

**Vor jedem Production Deploy:**

- [ ] `.env` existiert lokal (nicht committet)
- [ ] `.env` ist in `.gitignore`
- [ ] `environment.ts` hat `apiKey: ''` (leer)
- [ ] `environment.prod.ts` hat `apiKey: ''` (leer)
- [ ] Netlify Environment Variables gesetzt:
  - [ ] `OPENAI_API_KEY` oder `B_API_KEY`
  - [ ] Als **"secret"** markiert (✅ "Contains secret values")
  - [ ] Scopes: Production, Deploy Previews, Branch deploys
- [ ] `netlify.toml` definiert Functions-Ordner
- [ ] Lokaler Build getestet: `npm run build:prod`
- [ ] Bundle auf Keys durchsucht: `grep -r "sk-proj" dist/` → NICHTS gefunden ✅
- [ ] Nach Deploy: Production Bundle geprüft → KEINE Keys sichtbar ✅
- [ ] Deploy Log prüfen: "Secret scanning: No secrets found" ✅

---

## 🛠️ Troubleshooting

### Problem: "API key not configured" in Production

**Ursache:** Netlify Environment Variables nicht gesetzt.

**Lösung:**
1. Netlify Dashboard → Site Settings → Environment Variables
2. `B_API_KEY` und/oder `OPENAI_API_KEY` hinzufügen
3. Redeploy triggern (ohne Code-Änderung)

### Problem: CORS-Fehler lokal

**Ursache:** Universal Proxy läuft nicht.

**Lösung:**
```bash
npm run proxy  # Terminal 1
npm start      # Terminal 2
```

### Problem: "Failed to fetch" bei LLM-Requests

**Ursache:** Proxy-URL falsch oder Proxy nicht erreichbar.

**Lösung:**
- Lokal: `http://localhost:3001` muss laufen
- Production: Netlify Functions müssen deployed sein
- Browser-Konsole: Prüfen, welche URL aufgerufen wird

---

## 📚 Weitere Infos

- [Netlify Functions Docs](https://docs.netlify.com/functions/overview/)
- [Angular Environment Files](https://angular.dev/tools/cli/environments)
- [OWASP: Hardcoded Credentials](https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password)
