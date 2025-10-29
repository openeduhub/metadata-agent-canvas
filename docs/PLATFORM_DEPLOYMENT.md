# Platform & Deployment Configuration

**Platform Detection, Environment Variables & Configuration**

---

## 📋 Übersicht

Die App unterstützt **drei Deployment-Plattformen** und erkennt automatisch die richtige Konfiguration:

| Platform | API Endpoints | Detection | Environment Var |
|----------|---------------|-----------|-----------------|
| **Netlify** | `/.netlify/functions/*` | Hostname: `*.netlify.app` | `netlify` |
| **Vercel** | `/api/*` | Hostname: `*.vercel.app` | `vercel` |
| **Local** | `http://localhost:3001/*` | Hostname: `localhost` | `local` |
| **Auto** | Hostname-basiert | Runtime Detection | `auto` |

---

## 🎯 DEPLOYMENT_PLATFORM Variable

### Priority System

**Die Platform wird bestimmt durch (absteigend):**

```
1. Environment Variable (DEPLOYMENT_PLATFORM)  ← HÖCHSTE PRIORITÄT
   ↓
2. Hostname Detection (Runtime)
   ↓
3. Fallback: 'auto'
```

### Environment Variable setzen

**Netlify:**

```bash
netlify env:set DEPLOYMENT_PLATFORM "netlify"
```

**Vercel:**

```bash
# CLI
vercel env add DEPLOYMENT_PLATFORM
# Wert: vercel
# Environment: Production, Preview, Development

# Oder im Dashboard
# Settings → Environment Variables
# DEPLOYMENT_PLATFORM = vercel
```

**Lokal (.env):**

```bash
DEPLOYMENT_PLATFORM=local
```

---

## 🔍 Platform Detection Service

**Service:** `src/app/services/platform-detection.service.ts`

### Hostname-basierte Erkennung

```typescript
detectPlatform(): 'netlify' | 'vercel' | 'local' | 'unknown' {
  const hostname = window.location.hostname;

  // Netlify
  if (hostname.includes('netlify.app') || hostname.includes('netlify.com')) {
    return 'netlify';
  }

  // Vercel
  if (hostname.includes('vercel.app') || hostname.includes('vercel.sh')) {
    return 'vercel';
  }

  // Local
  if (hostname.includes('localhost') || hostname === '127.0.0.1') {
    return 'local';
  }

  // Unknown
  console.warn('⚠️ Platform: Unknown - Hostname:', hostname);
  return 'unknown';
}
```

### Runtime Fallback

Falls Platform = `unknown`:

```typescript
// Versuche aus Hostname zu erraten
const hostname = window.location.hostname;

if (hostname.includes('vercel')) {
  this.platform = 'vercel';
} else {
  // Default fallback: netlify
  this.platform = 'netlify';
}
```

---

## 🔧 Platform-spezifische Konfiguration

### API Endpoints

**Service:** `src/app/services/platform-detection.service.ts`

```typescript
getOpenAIProxyUrl(): string {
  switch (this.platform) {
    case 'netlify':
      return '/.netlify/functions/openai-proxy';
    case 'vercel':
      return '/api/openai-proxy';
    case 'local':
      return 'http://localhost:3001/llm';
    default:
      // Runtime check
      const hostname = window.location.hostname;
      return hostname.includes('vercel')
        ? '/api/openai-proxy'
        : '/.netlify/functions/openai-proxy';
  }
}

getRepositoryProxyUrl(): string {
  switch (this.platform) {
    case 'netlify':
      return '/.netlify/functions/guest-submit';
    case 'vercel':
      return '/api/guest-submit';
    case 'local':
      return 'http://localhost:3001/repository';
    default:
      // Runtime fallback
      const hostname = window.location.hostname;
      return hostname.includes('vercel')
        ? '/api/guest-submit'
        : '/.netlify/functions/guest-submit';
  }
}
```

---

## 🏠 Lokale Entwicklung

### .env File

**Template:** `.env.template`

```bash
# Platform (local für Entwicklung)
DEPLOYMENT_PLATFORM=local

# LLM Provider (b-api-openai | b-api-academic-cloud | openai)
LLM_PROVIDER=b-api-openai

# B-API Credentials
B_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
B_API_USERNAME=your-username
B_API_PASSWORD=your-password
B_API_BASE_URL=https://repository.staging.openeduhub.net

# ODER OpenAI (falls direkt genutzt)
OPENAI_API_KEY=sk-proj-xxxxxxxx...
OPENAI_MODEL=gpt-4o-mini
```

### Lokaler Proxy

**Start:** `npm run proxy` oder `node local-universal-proxy.js`

```bash
# Startet Proxy auf http://localhost:3001
# Routen:
# - /llm → OpenAI/B-API Proxy
# - /repository → Repository Proxy
# - /geocode → Geocoding Proxy
```

**Oder Netlify Dev (empfohlen):**

```bash
netlify dev
```

**Vorteile:**
- Netlify Functions lokal testen
- Environment Variables aus Netlify laden
- Gleiche Umgebung wie Production

---

## 🌐 Environment Files

### environment.ts (Development)

```typescript
export const environment = {
  production: false,
  deploymentPlatform: 'local',  // ← Wird von .env überschrieben
  
  llmProvider: 'b-api-openai',
  
  openai: {
    apiKey: '',  // ← IMMER LEER (lokale Proxy liest aus .env)
    proxyUrl: 'http://localhost:3001/llm',
    model: 'gpt-4o-mini',
    temperature: 0.3
  },
  
  // ... weitere Config
};
```

### environment.prod.ts (Production)

```typescript
export const environment = {
  production: true,
  deploymentPlatform: 'auto',  // ← Runtime Detection
  
  llmProvider: 'b-api-openai',
  
  openai: {
    apiKey: '',  // ← MUSS LEER SEIN!
    proxyUrl: '',  // ← Wird von PlatformDetectionService gesetzt
    model: 'gpt-4o-mini',
    temperature: 0.3
  },
  
  // ... weitere Config
};
```

**Wichtig:**
- `apiKey` MUSS immer `''` (leer) sein
- `deploymentPlatform: 'auto'` nutzt Runtime Detection
- `proxyUrl` wird dynamisch gesetzt (PlatformDetectionService)

---

## 🔐 Environment Variables

**Siehe auch:** [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)

### Deployment Platform

| Variable | Wert | Beschreibung |
|----------|------|--------------|
| `DEPLOYMENT_PLATFORM` | `netlify` | Netlify Deployment |
| `DEPLOYMENT_PLATFORM` | `vercel` | Vercel Deployment |
| `DEPLOYMENT_PLATFORM` | `local` | Lokale Entwicklung |
| `DEPLOYMENT_PLATFORM` | `auto` | Runtime Detection (Fallback) |

### LLM Provider

| Variable | Wert | Beschreibung |
|----------|------|--------------|
| `LLM_PROVIDER` | `b-api-openai` | B-API mit OpenAI Backend |
| `LLM_PROVIDER` | `b-api-academic-cloud` | B-API mit DeepSeek Backend |
| `LLM_PROVIDER` | `openai` | OpenAI direkt |

### API-Keys

| Variable | Beschreibung | Secret? |
|----------|--------------|---------|
| `OPENAI_API_KEY` | OpenAI API-Key | ✅ YES |
| `B_API_KEY` | B-API UUID-Key | ✅ YES |

### B-API Credentials

| Variable | Beschreibung | Secret? |
|----------|--------------|---------|
| `B_API_USERNAME` | B-API Username | ❌ No |
| `B_API_PASSWORD` | B-API Password | ✅ YES |
| `B_API_BASE_URL` | B-API Base URL | ❌ No |

---

## 🛠️ Debugging Platform Detection

### Console Logs

**Platform Detection:**

```typescript
// src/app/services/platform-detection.service.ts
console.log('🌍 Platform detected:', this.platform);
console.log('   Hostname:', window.location.hostname);
console.log('   OpenAI Proxy URL:', this.getOpenAIProxyUrl());
```

**Environment:**

```typescript
// src/app/app.component.ts
console.log('Environment:', environment);
console.log('Deployment Platform:', environment.deploymentPlatform);
console.log('LLM Provider:', environment.llmProvider);
```

### Network Tab

**Prüfe API-Calls:**

```
✅ Netlify: POST /.netlify/functions/openai-proxy
✅ Vercel:  POST /api/openai-proxy
✅ Local:   POST http://localhost:3001/llm

❌ FALSCH: POST /.netlify/functions/openai-proxy (auf Vercel!)
❌ FALSCH: POST /api/openai-proxy (auf Netlify!)
```

---

## ⚠️ Häufige Probleme

### Problem: 405 Method Not Allowed

**Symptom:**
```
POST /.netlify/functions/openai-proxy
→ 405 Method Not Allowed
```

**Ursache:** App läuft auf Vercel, nutzt aber Netlify-Endpoints

**Lösung:**
```bash
# Environment Variable setzen
vercel env add DEPLOYMENT_PLATFORM
# Wert: vercel
```

---

### Problem: Platform = 'unknown'

**Symptom:**
```
⚠️ Platform: Unknown - Hostname: my-custom-domain.com
```

**Ursache:** Hostname wird nicht erkannt

**Lösung 1 (empfohlen):**
```bash
# Environment Variable explizit setzen
netlify env:set DEPLOYMENT_PLATFORM "netlify"
```

**Lösung 2 (Code):**
```typescript
// src/app/services/platform-detection.service.ts
// Custom Hostname hinzufügen

if (hostname.includes('my-custom-domain.com')) {
  return 'netlify';
}
```

---

### Problem: API-Keys in Frontend

**Symptom:**
```
Netzwerk-Tab zeigt: apiKey: "sk-proj-..."
```

**Ursache:** API-Keys in `environment.prod.ts` hardcoded

**Lösung:**
```typescript
// environment.prod.ts
openai: {
  apiKey: '',  // ← MUSS LEER SEIN!
}
```

**Prüfen:**
```bash
grep -r "sk-proj" src/environments/
# → KEIN Output = ✅ Sicher
```

---

## 📊 Platform Detection Flow

```
App startet
  ↓
Liest Environment Variable: DEPLOYMENT_PLATFORM
  ↓
Falls gesetzt (netlify/vercel/local)
  ↓ YES → Nutze diesen Wert ✅
  ↓ NO  → Runtime Detection
  ↓
Prüfe Hostname (window.location.hostname)
  ↓
Netlify? (*.netlify.app)   → platform = 'netlify'
Vercel?  (*.vercel.app)    → platform = 'vercel'
Local?   (localhost)       → platform = 'local'
Unknown? (custom domain)   → platform = 'unknown'
  ↓
Falls 'unknown': Runtime Fallback
  ↓
Prüfe Hostname nochmal
  ↓
Vercel-ähnlich? → platform = 'vercel'
Sonst          → platform = 'netlify' (default)
  ↓
Setze API Endpoints basierend auf Platform ✅
```

---

## 🔗 Weitere Ressourcen

- **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)** - Vollständige Variable Reference
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment Guides
- **[SECURITY_GUIDE.md](./SECURITY_GUIDE.md)** - Security Best Practices
- **[LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)** - Lokale Entwicklung

---

**💡 Tipp:** Setze `DEPLOYMENT_PLATFORM` immer explizit in Environment Variables!
