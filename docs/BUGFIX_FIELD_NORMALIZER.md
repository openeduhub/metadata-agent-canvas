# 🐛 Bugfix: Field Normalizer Service - Hardcodierte URL

**Datum:** 19. Okt 2025  
**Status:** ✅ GEFIXT (Update: Proxy + Label-Qualität)

---

## 🐛 Update: Proxy 500 Error + Unsaubere Labels

**Datum:** 19. Okt 2025 (12:45 Uhr)

### Zusätzliche Probleme gefunden

1. **500 Internal Server Error vom Proxy**
   - FieldNormalizerService sendete kein `model` Parameter
   - Proxy benötigt `model` für API-Calls

2. **Unsaubere Label-Output von KI**
   ```
   ❌ "Pädagogik (auch: Erziehungswissenschaften)"
   ❌ "Open Educational Resources (auch: OER, OER)"
   ❌ "Politik (auch: Politische Bildung)"
   
   ✅ Sollte sein: "Pädagogik", "Open Educational Resources", "Politik"
   ```

### Fixes implementiert

#### Fix 1: Model-Parameter hinzugefügt

```typescript
// Get model from environment
const provider = environment.llmProvider || 'b-api-openai';
const providerConfig = (environment as any)[this.getProviderConfigKey(provider)];
const model = providerConfig?.model || 'gpt-4.1-mini';

return this.http.post<any>(this.apiUrl, {
  model: model,  // ✅ Jetzt vorhanden!
  messages: [...]
});
```

#### Fix 2: System-Prompt verschärft

```typescript
// VORHER
{ role: 'system', content: 'You are a data normalization assistant. Return only the normalized value without explanation.' }

// NACHHER (verschärft)
{ role: 'system', content: 'You are a data normalization assistant. Return ONLY the normalized value without any explanation, parentheses, or additional text.' }
```

#### Fix 3: Labels in Vocabulary bereinigt

```typescript
// Entfernt "(auch: ...)" aus Labels bevor sie an KI geschickt werden
const cleanLabel = concept.label.replace(/\s*\(auch:.*?\)/gi, '').trim();
prompt += `${idx + 1}. "${cleanLabel}"`;  // ✅ Sauber!
```

#### Fix 4: Explizite Prompt-Anweisungen

```
**KRITISCH - Ausgabe-Format:**
- Nur das reine Label zurückgeben
- KEINE Klammern wie "(auch: ...)"
- KEINE zusätzlichen Erklärungen
- Exakte Groß-/Kleinschreibung aus der Liste

**Beispiele:**
- Eingabe: "Pädagogik (auch: xyz)" → Ausgabe: "Pädagogik"
- Eingabe: "Politik oder so" → Ausgabe: "Politik"
```

---

**Status:** ✅ ALLE FIXES IMPLEMENTIERT

---

## 🔍 Problem

### Symptom

```
POST http://localhost:8000/generate net::ERR_CONNECTION_REFUSED
❌ Normalization failed for ccm:wwwurl
```

**Browser Console Log:**
- Viele Fehler: `POST http://localhost:8000/generate net::ERR_CONNECTION_REFUSED`
- Betraf: Field Normalization während der Extraktion
- Service konnte nicht erreicht werden

### Root Cause

`src/app/services/field-normalizer.service.ts` hatte eine **hardcodierte URL**:

```typescript
// ❌ VORHER (falsch)
export class FieldNormalizerService {
  private apiUrl = 'http://localhost:8000';  // ← Hardcoded!
  
  constructor(private http: HttpClient) {}
}
```

**Probleme:**
1. ❌ Port 8000 existiert nicht (sollte 3001 sein für lokalen Proxy)
2. ❌ Keine Unterscheidung zwischen lokal/production
3. ❌ Nutzt nicht die environment-basierte Konfiguration
4. ❌ Legacy API-Format (`/generate` endpoint mit `prompt` param)

---

## ✅ Lösung

### 1. Environment-basierte Proxy-URL

```typescript
// ✅ NACHHER (korrekt)
import { environment } from '../../environments/environment';

export class FieldNormalizerService {
  private apiUrl: string;  // ← Dynamisch

  constructor(private http: HttpClient) {
    const provider = environment.llmProvider || 'b-api-openai';
    const providerConfig = (environment as any)[this.getProviderConfigKey(provider)];
    
    if (environment.production) {
      // Production: Use Netlify Function
      this.apiUrl = providerConfig?.proxyUrl || '/.netlify/functions/openai-proxy';
    } else {
      // Local: Use local proxy
      this.apiUrl = providerConfig?.proxyUrl || 'http://localhost:3001/llm';
    }
    
    console.log('🔧 FieldNormalizerService initialized with proxy:', this.apiUrl);
  }
}
```

### 2. OpenAI-kompatibles API-Format

```typescript
// ❌ VORHER (Legacy Format)
return this.http.post<any>(`${this.apiUrl}/generate`, {
  prompt: prompt,
  temperature: 0.1,
  max_tokens: 200
});

// ✅ NACHHER (OpenAI Format)
return this.http.post<any>(this.apiUrl, {
  messages: [
    { role: 'system', content: 'You are a data normalization assistant.' },
    { role: 'user', content: prompt }
  ],
  temperature: 0.1,
  max_tokens: 200
});
```

### 3. Response-Parsing angepasst

```typescript
// ✅ Unterstützt beide Formate (OpenAI & Legacy)
map(response => {
  const content = response.choices?.[0]?.message?.content || response.content || '';
  return this.parseNormalizationResponse(content, field, userInput);
})
```

---

## 🔄 Neue Architektur

### Lokal (Development)

```
FieldNormalizerService
  ↓
http://localhost:3001/llm
  ↓
local-universal-proxy.js
  ↓
OpenAI/B-API
```

### Production (Netlify)

```
FieldNormalizerService
  ↓
/.netlify/functions/openai-proxy
  ↓
Netlify Function
  ↓
OpenAI/B-API
```

---

## ✅ Vorteile der Lösung

| Aspekt | Vorher | Nachher |
|--------|--------|---------|
| **URL** | Hardcoded `localhost:8000` | Environment-basiert |
| **Lokal** | ❌ Connection Refused | ✅ Nutzt Proxy (Port 3001) |
| **Production** | ❌ Würde nicht funktionieren | ✅ Nutzt Netlify Functions |
| **API-Format** | Legacy (`/generate`, `prompt`) | OpenAI-kompatibel (`messages`) |
| **Provider** | Fixed | Folgt `environment.llmProvider` |
| **Wartbarkeit** | Schwierig | Zentrale Konfiguration |

---

## 🧪 Testing

### Test 1: Lokaler Modus

```bash
# Terminal 1: Proxy starten
npm run proxy

# Terminal 2: App starten
npm start

# Test: Extraktion starten
# ✅ Keine Connection Refused Errors mehr
# ✅ Normalization läuft über localhost:3001/llm
```

**Erwartete Logs:**
```
🔧 FieldNormalizerService initialized with proxy: http://localhost:3001/llm
📝 Normalization prompt for cclom:title: ...
📥 Raw response for cclom:title: {...}
✅ Normalized cclom:title: "..." → "..."
```

### Test 2: Production Build

```bash
npm run build
# ✅ apiUrl wird auf /.netlify/functions/openai-proxy gesetzt
```

---

## 📊 Impact

### Services betroffen

- ✅ `FieldNormalizerService` - GEFIXT

### Services die korrekt waren

- ✅ `OpenAIProxyService` - Nutzt bereits environment.ts
- ✅ `GeocodingService` - Nutzt bereits environment.ts
- ✅ `GuestSubmissionService` - Nutzt bereits environment.ts

---

## 🔍 Wie wurde das Problem gefunden?

1. **User Report:** Browser Console zeigte Errors
2. **Log-Analyse:** `POST http://localhost:8000/generate net::ERR_CONNECTION_REFUSED`
3. **Code-Suche:** `grep -r "8000" src/` → Fand hardcodierte URL
4. **Root Cause:** Service nutzte nicht die gleiche Proxy-Architektur wie andere Services

---

## 📚 Lessons Learned

### ❌ Nicht mehr machen

- Hardcodierte URLs in Services
- Legacy API-Formate nutzen
- Direkte API-Calls ohne Proxy

### ✅ Best Practices

- Immer `environment.ts` für Konfiguration nutzen
- Konsistente Proxy-Architektur über alle Services
- OpenAI-kompatibles Format für LLM-Calls
- Environment-abhängige URLs (lokal vs production)

---

## 🎯 Zusammenfassung

**Problem:** FieldNormalizerService hatte hardcodierte URL `localhost:8000/generate`

**Lösung:** 
1. ✅ Environment-basierte Proxy-URL (wie andere Services)
2. ✅ OpenAI-kompatibles API-Format
3. ✅ Lokal: `http://localhost:3001/llm`
4. ✅ Production: `/.netlify/functions/openai-proxy`

**Status:** ✅ **KOMPLETT GEFIXT**

**Testing:** Nach `npm start` keine Connection Refused Errors mehr!
