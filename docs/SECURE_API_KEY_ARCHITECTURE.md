# 🔒 Sichere API-Key Architektur

**Status:** ✅ Implementiert (Januar 2025)  
**Prinzip:** KEINE API-Keys im Frontend-Code

---

## 🎯 Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (Angular - Browser)                            │
│ • apiKey: '' (IMMER LEER!)                             │
│ • Nur Proxy-URLs bekannt                               │
│ • Keine direkten API-Calls                             │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTP Requests (ohne Keys)
        ┌───────────┴───────────┐
        │                       │
    Local Dev              Production
        │                       │
        ▼                       ▼
┌────────────────┐      ┌────────────────┐
│ .env File      │      │ Netlify Env    │
│ (gitignored)   │      │ Variables      │
│                │      │ (Dashboard)    │
│ OPENAI_API_KEY │      │ Secret marked  │
│ B_API_KEY      │      │ Write-only     │
└────────┬───────┘      └───────┬────────┘
         │                      │
         ▼                      ▼
┌────────────────┐      ┌────────────────┐
│ Universal      │      │ Netlify        │
│ Proxy          │      │ Functions      │
│ (Port 3001)    │      │ /.netlify/*    │
│                │      │                │
│ Reads .env     │      │ Reads          │
│ Adds keys to   │      │ process.env    │
│ requests       │      │ Adds keys      │
└────────┬───────┘      └───────┬────────┘
         │                      │
         └──────────┬───────────┘
                    │ HTTP Requests (mit Keys)
                    ▼
            ┌───────────────┐
            │ External APIs │
            │ • OpenAI      │
            │ • B-API       │
            │ • Geocoding   │
            └───────────────┘
```

---

## 🔐 Sicherheitsprinzipien

### ✅ DO's

1. **API-Keys NIEMALS im Code**
   ```typescript
   // ✅ RICHTIG
   apiKey: ''  // Leer!
   
   // ❌ FALSCH
   apiKey: 'sk-proj-...'  // Wird im Bundle sichtbar!
   ```

2. **Nur Proxy-URLs im Frontend**
   ```typescript
   // Local Development
   proxyUrl: 'http://localhost:3001/llm'
   
   // Production
   proxyUrl: '/.netlify/functions/openai-proxy'
   ```

3. **Keys bleiben server-side**
   - Lokal: `.env` → `local-universal-proxy.js`
   - Netlify: Dashboard Env Vars → Netlify Functions

### ❌ DON'Ts

- ❌ Keys in `environment.ts` oder `environment.prod.ts` hardcoden
- ❌ Keys via `replace-env.js` injizieren (ENTFERNT!)
- ❌ Direct API Calls vom Frontend aus
- ❌ `.env` Datei committen

---

## 🛠️ Implementierung

### 1. Environment Files (Angular)

**`src/environments/environment.ts`**
```typescript
export const environment = {
  production: false,
  
  llmProvider: 'b-api-openai', // oder 'openai', 'b-api-academiccloud'
  
  openai: {
    apiKey: '', // ← IMMER LEER!
    baseUrl: '',
    proxyUrl: 'http://localhost:3001/llm', // Local proxy
    model: 'gpt-4.1-mini',
    temperature: 0.3
  },
  
  bApiOpenai: {
    apiKey: '', // ← IMMER LEER!
    baseUrl: 'https://b-api.staging.openeduhub.net/api/v1/llm/openai',
    proxyUrl: 'http://localhost:3001/llm',
    model: 'gpt-4.1-mini',
    temperature: 0.3,
    requiresCustomHeader: true
  },
  
  // ... weitere Provider
};
```

**`src/environments/environment.prod.ts`**
```typescript
export const environment = {
  production: true,
  
  openai: {
    apiKey: '', // ← IMMER LEER!
    proxyUrl: '', // Fallback: /.netlify/functions/openai-proxy
    // ...
  },
  
  bApiOpenai: {
    apiKey: '', // ← IMMER LEER!
    proxyUrl: '', // Fallback: /.netlify/functions/openai-proxy
    // ...
  }
};
```

### 2. Lokale Entwicklung

**`.env` Datei erstellen:**
```bash
# Kopieren Sie das Template
cp .env.template .env

# Inhalt (.env ist in .gitignore!)
LLM_PROVIDER=b-api-openai
B_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
OPENAI_API_KEY=sk-proj-your-key
```

**Universal Proxy starten:**
```bash
# Terminal 1
npm run proxy

# Terminal 2
npm start
```

**Was passiert:**
1. `local-universal-proxy.js` lädt `.env` Datei
2. Proxy läuft auf `localhost:3001`
3. Angular sendet Requests an Proxy (OHNE Keys)
4. Proxy fügt Keys aus `.env` hinzu
5. Proxy sendet Request an externe API

### 3. Netlify Production

**Environment Variables setzen:**
```bash
# Via CLI
netlify env:set OPENAI_API_KEY "sk-proj-your-key" --secret
netlify env:set B_API_KEY "your-uuid-key" --secret
netlify env:set LLM_PROVIDER "b-api-openai"

# Oder: Dashboard → Site Settings → Environment Variables
# ✅ "Contains secret values" aktivieren!
```

**Was passiert:**
1. Angular Build enthält KEINE Keys (werden validiert!)
2. Angular sendet Requests an `/.netlify/functions/openai-proxy`
3. Netlify Function liest Keys aus `process.env`
4. Function fügt Keys zum Request hinzu
5. Function sendet Request an externe API

---

## 🔍 Security Validation

### Build-Zeit Validierung

**`validate-env.js`** (NEU - ersetzt `replace-env.js`)

```javascript
// Prüft bei jedem Build:
✅ Sind alle apiKey Felder leer?
✅ Keine hardcodeten Keys im Code?
❌ Build schlägt fehl wenn Keys gefunden werden!
```

**Ausgeführt bei:**
- `npm start` (Development)
- `npm run build:prod` (Production)
- Netlify Build (automatisch)

**Beispiel-Output:**
```
═══════════════════════════════════════════════════════════
🔒 SECURE Environment Configuration Validator
═══════════════════════════════════════════════════════════

📝 Validating environment.ts...
  ✅ Security check PASSED: No API keys in code
  ✅ environment.ts validated

📝 Validating environment.prod.ts...
  ✅ Security check PASSED: No API keys in code
  ✅ environment.prod.ts validated

═══════════════════════════════════════════════════════════
✅ Validation COMPLETE - Environment files are secure!
═══════════════════════════════════════════════════════════
```

### Runtime Validierung

**Netlify Secrets Controller:**
- Scannt Bundle vor Deployment
- Erkennt Keys in plaintext, base64, URI-encoded
- Build schlägt fehl bei gefundenen Secrets
- Deploy Log: "Secret scanning: No secrets found" ✅

---

## 📊 Request Flow

### Local Development

```
1. User Action (Browser)
   ↓
2. Angular Component
   ↓
3. OpenAIProxyService
   | - Kein API-Key
   | - proxyUrl: http://localhost:3001/llm
   ↓
4. HTTP POST http://localhost:3001/llm
   | Body: { messages: [...], model: "gpt-4.1-mini" }
   | Headers: (keine API-Keys!)
   ↓
5. local-universal-proxy.js (Port 3001)
   | - Liest OPENAI_API_KEY aus .env
   | - Fügt Authorization Header hinzu
   | - Fügt CORS Headers hinzu
   ↓
6. External API (OpenAI/B-API)
   ↓
7. Response zurück durch Proxy
   ↓
8. Angular Component
```

### Production (Netlify)

```
1. User Action (Browser)
   ↓
2. Angular Component
   ↓
3. OpenAIProxyService
   | - Kein API-Key
   | - proxyUrl: /.netlify/functions/openai-proxy
   ↓
4. HTTP POST /.netlify/functions/openai-proxy
   | Body: { messages: [...], model: "gpt-4.1-mini" }
   | Headers: (keine API-Keys!)
   ↓
5. netlify/functions/openai-proxy.js
   | - Liest process.env.OPENAI_API_KEY
   | - Fügt Authorization Header hinzu
   ↓
6. External API (OpenAI/B-API)
   ↓
7. Response zurück durch Function
   ↓
8. Angular Component
```

---

## 🧪 Testing & Verification

### Lokal testen

```bash
# 1. Build erstellen
npm run build:prod

# 2. Bundle auf Leaks prüfen
grep -r "sk-proj" dist/
grep -r "bb6cdf" dist/

# Sollte NICHTS finden!
```

**PowerShell:**
```powershell
Select-String -Path "dist/*.js" -Pattern "sk-proj|bb6cdf"
# Sollte NICHTS finden!
```

### Nach Netlify Deploy

1. **Deploy Log prüfen:**
   ```
   ✅ Secret scanning: No secrets found
   ✅ Build successful
   ```

2. **Browser DevTools:**
   - Sources Tab öffnen
   - `main.*.js` durchsuchen nach `sk-proj` oder UUID-Pattern
   - **Sollte NICHTS finden!**

3. **Funktionalität testen:**
   - Metadata-Extraktion starten
   - Sollte funktionieren (Keys werden server-side hinzugefügt)

---

## 🚨 Troubleshooting

### Problem: "API key not configured"

**Ursache:** Keys nicht gesetzt

**Lösung (Lokal):**
```bash
# Prüfen ob .env existiert
ls .env

# Falls nicht:
cp .env.template .env
notepad .env  # Keys eintragen

# Proxy neu starten
npm run proxy
```

**Lösung (Netlify):**
```bash
netlify env:set OPENAI_API_KEY "sk-proj-..." --secret
netlify env:set B_API_KEY "uuid-key" --secret

# Redeploy triggern
```

### Problem: Build schlägt fehl mit "SECURITY ERROR"

**Ursache:** API-Keys im Code gefunden

**Beispiel-Fehler:**
```
❌ SECURITY ERROR: API keys found in environment.prod.ts!

🔍 Detected leaks:
   1. OpenAI API Key: sk-proj-xxxxxxxx...
   2. B-API Key (UUID): xxxxxxxx-xxxx-xxxx-xxxx-...
```

**Lösung:**
```typescript
// Alle apiKey Felder auf leer setzen:
apiKey: ''  // Nicht 'sk-proj-...'!
```

### Problem: ERR_CONNECTION_REFUSED localhost:3001

**Ursache:** Proxy läuft nicht

**Lösung:**
```bash
# In separatem Terminal starten:
npm run proxy

# Sollte zeigen:
# 🚀 Starting Universal API Proxy...
# 📡 Proxy listening on: http://localhost:3001
```

---

## 📚 Verwandte Dokumentation

| Dokument | Beschreibung |
|----------|-------------|
| **NETLIFY_SECRETS_CONTROLLER.md** | Netlify Secrets Controller Setup |
| **QUICKSTART_NETLIFY_SECRETS.md** | 5-Minuten Quick Start |
| **SECURITY_SUMMARY.md** | Sicherheitsübersicht |
| **TROUBLESHOOTING.md** | Häufige Probleme & Lösungen |
| **.env.template** | Template für lokale `.env` |

---

## 🔄 Migration von alter Architektur

### Was wurde geändert?

**VORHER (UNSICHER):**
```javascript
// replace-env.js injizierte Keys in Code!
content = content.replace(
  /apiKey: ''/,
  `apiKey: '${process.env.OPENAI_API_KEY}'`
);
// ❌ Keys landeten im Bundle!
```

**NACHHER (SICHER):**
```javascript
// validate-env.js prüft nur
if (hasApiKeyLeak(content)) {
  console.error('❌ API keys found in code!');
  process.exit(1);
}
// ✅ Keys bleiben server-side
```

### Migration Checklist

- [x] `replace-env.js` entfernt (API-Key Injection)
- [x] `validate-env.js` erstellt (nur Validierung)
- [x] `package.json` Scripts aktualisiert
- [x] `environment.ts` - alle `apiKey: ''` (leer)
- [x] `environment.prod.ts` - alle `apiKey: ''` (leer)
- [x] `.env` Datei lokal erstellt (aus `.env.template`)
- [x] Netlify Environment Variables gesetzt (mit --secret)
- [x] Console-Logs im Service vereinfacht
- [x] Dokumentation aktualisiert

---

## ✅ Sicherheits-Checkliste

### Code-Ebene
- [x] Keine API-Keys in `environment.ts`
- [x] Keine API-Keys in `environment.prod.ts`
- [x] Keine Key-Injection in Build-Scripts
- [x] Build-Zeit Validierung aktiv (`validate-env.js`)
- [x] Console-Logs enthalten keine Keys

### Lokal
- [x] `.env` Datei in `.gitignore`
- [x] `.env` Datei existiert lokal (nicht committed)
- [x] Universal Proxy liest aus `.env`
- [x] Angular nutzt nur Proxy-URLs

### Netlify
- [x] Environment Variables gesetzt
- [x] Als "secret" markiert (write-only)
- [x] Secret Scanning aktiviert
- [x] Netlify Functions lesen aus `process.env`
- [x] Bundle enthält keine Keys (verified)

---

**Stand:** Januar 2025  
**Architektur:** Zero-Trust Frontend, Server-Side Keys Only
