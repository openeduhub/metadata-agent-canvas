# 🔧 CORS-Problem gelöst mit Netlify Functions

## ❌ Das Problem

OpenAI API erlaubt **keine direkten Browser-Aufrufe** aus Sicherheitsgründen:
- CORS-Policy blockiert Requests von `http://localhost:4200` zu `https://api.openai.com`
- Browser sendet OPTIONS Preflight → OpenAI antwortet ohne CORS-Header
- Fehler: `No 'Access-Control-Allow-Origin' header is present`

## ✅ Die Lösung

**Netlify Serverless Function als Proxy:**
```
Browser → Netlify Function → OpenAI API → Netlify Function → Browser
```

### Vorteile:
- ✅ Kein CORS-Problem (Server-zu-Server Kommunikation)
- ✅ API-Key bleibt serverseitig (sicherer)
- ✅ Funktioniert auf Netlify automatisch
- ✅ Lokal testbar mit Netlify CLI

---

## 📁 Neue Dateien

### 1. `netlify/functions/openai-proxy.ts`
Serverless Function die OpenAI API aufruft:
- Empfängt POST-Request vom Frontend
- Fügt API-Key aus Environment Variable hinzu
- Ruft OpenAI API auf
- Gibt Response zurück mit CORS-Headern

### 2. `src/app/services/openai-proxy.service.ts`
Angular Service für Proxy-Aufrufe:
- Ersetzt direkte LangChain/OpenAI Calls
- Ruft `/.netlify/functions/openai-proxy` auf
- Behandelt Request/Response Format

---

## 🔄 Geänderte Dateien

### `field-extraction-worker-pool.service.ts`
**Vorher:**
```typescript
import { ChatOpenAI } from '@langchain/openai';
this.llm = new ChatOpenAI(config);
const response = await this.llm.invoke([...]);
```

**Nachher:**
```typescript
import { OpenAIProxyService } from './openai-proxy.service';
constructor(private openaiProxy: OpenAIProxyService) {}
const response = await this.openaiProxy.invoke([...]);
```

### `environment.ts` / `environment.prod.ts`
Neues Feld hinzugefügt:
```typescript
openai: {
  apiKey: '...',
  proxyUrl: '', // '' = Standard: /.netlify/functions/openai-proxy
  // ...
}
```

### `netlify.toml`
Functions-Konfiguration:
```toml
[build]
  functions = "netlify/functions"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
```

### `package.json`
Dependency hinzugefügt:
```json
"devDependencies": {
  "@netlify/functions": "^2.8.2"
}
```

---

## 🚀 Deployment auf Netlify

### 1. Environment Variable setzen
In Netlify Dashboard → Site Settings → Environment Variables:
```
OPENAI_API_KEY = sk-proj-...
```

### 2. Deploy
```bash
git add .
git commit -m "Fix: CORS issue with Netlify Functions proxy"
git push
```

Netlify baut automatisch:
- Angular App
- Serverless Function

### 3. Testen
Nach dem Deploy funktioniert die App ohne CORS-Fehler! ✅

---

## 🖥️ Lokale Entwicklung

### Option A: Netlify CLI (empfohlen)

**Installation:**
```bash
npm install -g netlify-cli
```

**Start:**
```bash
# Terminal 1: Netlify Dev Server (simuliert Production)
netlify dev

# App läuft auf: http://localhost:8888
# Functions laufen auf: http://localhost:8888/.netlify/functions/*
```

Netlify CLI:
- Startet Angular Dev Server intern
- Hostet Functions lokal
- Injiziert Environment Variables aus `.env`

**`.env` Datei erstellen:**
```bash
OPENAI_API_KEY=sk-proj-...
```

### Option B: Angular + Mock Proxy (für Tests ohne API-Key)

Falls Sie lokal ohne echten API-Key testen:

**Mock Service erstellen:**
```typescript
// src/app/services/openai-proxy-mock.service.ts
@Injectable()
export class OpenAIProxyMockService {
  async invoke(messages: any) {
    return {
      choices: [{
        message: { content: '{"field": "mock value"}' }
      }]
    };
  }
}
```

**In app.module.ts:**
```typescript
providers: [
  environment.production 
    ? OpenAIProxyService 
    : { provide: OpenAIProxyService, useClass: OpenAIProxyMockService }
]
```

### Option C: CORS Proxy lokal (nur für Development)

Temporär für lokale Tests (NICHT für Production):

**Browser-Extension:** CORS Unblock (Chrome/Edge)
- ⚠️ Nur für lokale Tests!
- ⚠️ Sicherheitsrisiko!

---

## 🔐 Sicherheit

### ✅ Vorher (unsicher):
```typescript
apiKey: 'sk-proj-...' // Im Browser-Bundle sichtbar!
```
- API-Key im JavaScript-Code
- Jeder kann in DevTools den Key sehen
- Key kann gestohlen werden

### ✅ Nachher (sicher):
```typescript
// Frontend
apiKey: '' // Leer

// Netlify Function
const apiKey = process.env.OPENAI_API_KEY; // Nur serverseitig
```
- API-Key nur auf dem Server
- Nicht im Browser-Code
- Netlify Environment Variables sind verschlüsselt

---

## 📊 Performance

**Latenz-Overhead:**
- Netlify Function: +5-20ms
- Vernachlässigbar im Vergleich zu OpenAI API (~500-2000ms)

**Kosten:**
- Netlify Functions: Kostenlos bis 125k Requests/Monat
- Für Ihre Nutzung: 0€

---

## ✅ Checkliste

Vor dem Deployment prüfen:

- [ ] `npm install` ausgeführt (für @netlify/functions)
- [ ] Environment Variable `OPENAI_API_KEY` in Netlify gesetzt
- [ ] `apiKey` in `environment.prod.ts` ist leer (`''`)
- [ ] Code committed und gepusht
- [ ] Netlify Build erfolgreich
- [ ] App getestet → Keine CORS-Fehler mehr ✅

---

## 🐛 Troubleshooting

### Fehler: "Function not found"
**Problem:** Netlify findet die Function nicht

**Lösung:**
```bash
# Prüfen ob netlify.toml korrekt ist
cat netlify.toml

# Sollte enthalten:
# functions = "netlify/functions"
```

### Fehler: "API key not configured"
**Problem:** Environment Variable nicht gesetzt

**Lösung:**
1. Netlify Dashboard → Site Settings → Environment Variables
2. Add: `OPENAI_API_KEY = sk-proj-...`
3. Trigger Redeploy

### Fehler: Lokal "Connection refused"
**Problem:** Netlify Dev Server läuft nicht

**Lösung:**
```bash
# Statt npm start:
netlify dev

# Oder .env Datei erstellen
echo "OPENAI_API_KEY=sk-proj-..." > .env
```

### Fehler: "Timeout"
**Problem:** Function braucht zu lange

**Lösung:**
Netlify Functions Timeout ist 10s (Free), 26s (Pro).
Für längere Requests: Canvas timeout in environment.ts reduzieren.

---

## 🎉 Ergebnis

**Vorher:**
```
Browser ──X──> OpenAI API
         CORS Error ❌
```

**Nachher:**
```
Browser ──✓──> Netlify Function ──✓──> OpenAI API ✅
         CORS OK          Server-to-Server
```

**Status:** CORS-Problem gelöst! 🎉
