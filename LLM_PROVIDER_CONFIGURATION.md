# LLM Provider Configuration

Die App unterstützt mehrere OpenAI-kompatible LLM-Provider. Zwischen den Providern kann über die Environment-Konfiguration gewechselt werden.

## Unterstützte Provider

### 1. OpenAI (Standard)
- **Provider-ID:** `openai`
- **Base URL:** `https://api.openai.com/v1`
- **Authentifizierung:** Bearer Token (Authorization Header)
- **Environment Variable:** `OPENAI_API_KEY`

### 2. Provider B (OpenEduHub)
- **Provider-ID:** `provider-b`
- **Base URL:** `https://b-api.staging.openeduhub.net/api/v1/llm/openai`
- **Authentifizierung:** Custom Header (`X-API-KEY`)
- **Environment Variable:** `B_API_KEY`

---

## Lokale Entwicklung (Development Mode)

### Environment-Konfiguration

**Datei:** `src/environments/environment.ts`

```typescript
export const environment = {
  production: false,
  
  // Provider auswählen: 'openai' oder 'provider-b'
  llmProvider: 'openai',
  
  // OpenAI Configuration
  openai: {
    apiKey: 'sk-proj-...', // Dein OpenAI API Key
    baseUrl: '', // Leer lassen für Standard-URL
    model: 'gpt-4.1-mini',
    temperature: 0.3
  },
  
  // Provider B Configuration
  providerB: {
    apiKey: 'bb6cdf84-...', // Dein Provider B API Key
    baseUrl: 'https://b-api.staging.openeduhub.net/api/v1/llm/openai',
    model: 'gpt-4.1-mini',
    temperature: 0.3,
    requiresCustomHeader: true // Wichtig für X-API-KEY Header
  }
};
```

### Provider wechseln

Ändere einfach `llmProvider` in `environment.ts`:

```typescript
// OpenAI verwenden
llmProvider: 'openai',

// ODER Provider B verwenden
llmProvider: 'provider-b',
```

---

## Production (Netlify)

### Environment Variables konfigurieren

**Netlify Dashboard → Site Settings → Environment Variables**

Füge folgende Variablen hinzu:

```bash
# Für OpenAI
OPENAI_API_KEY=sk-proj-...

# Für Provider B
B_API_KEY=bb6cdf84-0a9d-47f3-b673-c1b4f25b9bdc
```

### Provider wechseln

**Option 1: Build-Zeit-Konfiguration**

Ändere `llmProvider` in `src/environments/environment.prod.ts`:

```typescript
llmProvider: 'provider-b',
```

**Option 2: Environment Variable (geplant)**

Zukünftig könnte auch eine ENV-Variable genutzt werden:
```bash
LLM_PROVIDER=provider-b
```

---

## API-Unterschiede

### OpenAI
```javascript
// Request Headers
{
  'Content-Type': 'application/json',
  'Authorization': 'Bearer sk-proj-...'
}

// API Endpoint
POST https://api.openai.com/v1/chat/completions
```

### Provider B
```javascript
// Request Headers
{
  'Content-Type': 'application/json',
  'X-API-KEY': 'bb6cdf84-0a9d-47f3-b673-c1b4f25b9bdc'
}

// API Endpoint
POST https://b-api.staging.openeduhub.net/api/v1/llm/openai/chat/completions
```

**Python-Beispiel für Provider B:**
```python
from openai import OpenAI

client = OpenAI(
    api_key="bb6cdf84-0a9d-47f3-b673-c1b4f25b9bdc",
    base_url="https://b-api.staging.openeduhub.net/api/v1/llm/openai",
    default_headers={"X-API-KEY": "bb6cdf84-0a9d-47f3-b673-c1b4f25b9bdc"}
)

response = client.chat.completions.create(
    model="gpt-4.1-mini",
    messages=[{"role": "user", "content": "Hallo!"}]
)
```

---

## Architektur

### Development Mode (Lokal)

```
Browser
  ↓
openai-proxy.service.ts (Angular)
  ↓
[Provider-Auswahl basierend auf llmProvider]
  ↓
├─ openai → https://api.openai.com/v1/chat/completions
│             Header: Authorization: Bearer <OPENAI_API_KEY>
│
└─ provider-b → https://b-api.staging.openeduhub.net/api/v1/llm/openai/chat/completions
                Header: X-API-KEY: <B_API_KEY>
```

### Production Mode (Netlify)

```
Browser
  ↓
openai-proxy.service.ts (Angular)
  ↓
Netlify Function (/.netlify/functions/openai-proxy)
  ↓ [provider=openai/provider-b]
  ↓
├─ openai → https://api.openai.com/v1/chat/completions
│             Header: Authorization: Bearer <OPENAI_API_KEY>
│             ENV: OPENAI_API_KEY
│
└─ provider-b → https://b-api.staging.openeduhub.net/api/v1/llm/openai/chat/completions
                Header: X-API-KEY: <B_API_KEY>
                ENV: B_API_KEY
```

---

## Fehlerbehandlung

Beide Provider nutzen das **gleiche Retry-System**:
- **Max. 3 Retries** bei transienten Fehlern (402, 429, 500, 502, 503, 504)
- **Exponential Backoff** mit Jitter (1s → 2s → 4s)
- **Automatic Failover** bei Netzwerkfehlern

---

## Weitere Provider hinzufügen

Um einen weiteren Provider (z.B. `provider-c`) hinzuzufügen:

1. **Environment erweitern** (`environment.ts`, `environment.prod.ts`):
   ```typescript
   providerC: {
     apiKey: '',
     baseUrl: 'https://api.provider-c.com',
     model: 'gpt-4.1-mini',
     temperature: 0.3,
     requiresCustomHeader: false // oder true
   }
   ```

2. **Service erweitern** (`openai-proxy.service.ts`):
   ```typescript
   this.providerConfig = this.provider === 'provider-c' 
     ? (environment as any).providerC 
     : ...
   ```

3. **Netlify Function erweitern** (`netlify/functions/openai-proxy.js`):
   ```javascript
   if (selectedProvider === 'provider-c') {
     apiKey = process.env.C_API_KEY;
     baseUrl = 'https://api.provider-c.com';
     requiresCustomHeader = false;
   }
   ```

4. **Environment Variable auf Netlify setzen**:
   ```
   C_API_KEY=...
   ```

---

## Tests

### Provider-Wechsel testen

```bash
# Provider B aktivieren
# Ändere in environment.ts: llmProvider: 'provider-b'

# App neu starten
npm start

# Console prüfen:
# "🔧 Development mode: Using direct PROVIDER-B API access"
# "🌐 Base URL: https://b-api.staging.openeduhub.net/api/v1/llm/openai"
```

### API-Call verifizieren

Öffne Browser DevTools → Network Tab:
- **OpenAI:** Request zu `api.openai.com` mit `Authorization: Bearer ...`
- **Provider B:** Request zu `b-api.staging.openeduhub.net` mit `X-API-KEY: ...`

---

## Troubleshooting

### "API key not configured"

**Lokal:**
- Prüfe `environment.ts` → `providerB.apiKey` ist gesetzt
- Prüfe `llmProvider: 'provider-b'` ist korrekt

**Netlify:**
- Prüfe Environment Variables → `B_API_KEY` ist gesetzt
- Prüfe `environment.prod.ts` → `llmProvider: 'provider-b'`

### "CORS error"

**Provider B:**
- Stelle sicher, dass die Base URL korrekt ist
- Prüfe, ob `requiresCustomHeader: true` gesetzt ist

### "Unauthorized"

**OpenAI:**
- API Key ist ungültig oder abgelaufen
- Check: `OPENAI_API_KEY` ENV variable

**Provider B:**
- API Key ist ungültig
- Check: `B_API_KEY` ENV variable
- Check: `X-API-KEY` Header wird gesendet

---

**Stand:** 15. Oktober 2025
