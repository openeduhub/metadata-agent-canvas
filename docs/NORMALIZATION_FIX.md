# 🔧 Normalization Service Fix - Platform Detection

## ❌ Problem

**Symptom:**
- Normale LLM-Aufrufe funktionieren ✅
- Normalisierung schlägt fehl mit 405 Error ❌
- Requests gehen zu `/.netlify/functions/openai-proxy` statt `/api/openai-proxy`

**Screenshot zeigte:**
```
POST https://metadata-agent-canvas.vercel.app/.netlify/functions/openai-proxy
→ 405 Method Not Allowed
```

## 🔍 Root Cause

**Zwei Services hatten hardcoded Netlify-Endpunkte:**

### 1. FieldNormalizerService (Normalisierung)
```typescript
// ❌ VORHER - Zeile 28
if (environment.production) {
  this.apiUrl = providerConfig?.proxyUrl || '/.netlify/functions/openai-proxy';  // HARDCODED!
}
```

### 2. GuestSubmissionService (Repository)
```typescript
// ❌ VORHER - Zeile 19
if (environment.production) {
  return '/.netlify/functions/repository-proxy';  // HARDCODED!
}
```

**Diese Services nutzten NICHT die Platform-Detection!**

## ✅ Fix Implementiert

### 1. FieldNormalizerService

```typescript
// ✅ NACHHER
import { PlatformDetectionService } from './platform-detection.service';

constructor(
  private http: HttpClient,
  private platformDetection: PlatformDetectionService
) {
  if (environment.production) {
    // Use Platform Detection (works for Vercel AND Netlify)
    this.apiUrl = providerConfig?.proxyUrl || this.platformDetection.getOpenAIProxyUrl();
    console.log(`🔧 FieldNormalizerService: ${this.platformDetection.getPlatformName()} → ${this.apiUrl}`);
  }
}
```

### 2. GuestSubmissionService

```typescript
// ✅ NACHHER
import { PlatformDetectionService } from './platform-detection.service';

constructor(private platformDetection: PlatformDetectionService) {
  this.PROXY_URL = this.getProxyUrl();
}

private getProxyUrl(): string {
  if (environment.production) {
    // Use Platform Detection for correct endpoint
    const proxyUrl = this.platformDetection.getRepositoryProxyUrl();
    console.log(`📦 Repository proxy (${this.platformDetection.getPlatformName()}): ${proxyUrl}`);
    return proxyUrl;
  }
}
```

## 📋 Geänderte Dateien

### Modified:
1. ✅ **`field-normalizer.service.ts`** - Nutzt jetzt Platform-Detection
2. ✅ **`guest-submission.service.ts`** - Nutzt jetzt Platform-Detection

### Already Correct:
3. ✅ **`geocoding.service.ts`** - Nutzte bereits Platform-Detection
4. ✅ **`openai-proxy.service.ts`** - Nutzte bereits Platform-Detection
5. ✅ **`platform-detection.service.ts`** - Verbesserte Vercel-Detection

## 🎯 Erwartetes Verhalten

### Nach dem Fix (auf Vercel):

**Browser Console sollte zeigen:**
```
🔍 [PLATFORM DETECTION] Starting detection...
🔍 [PLATFORM DETECTION] Hostname: metadata-agent-canvas.vercel.app
✅ [PLATFORM DETECTION] Detected: VERCEL (hostname)
   Hostname: metadata-agent-canvas.vercel.app
✅ [PLATFORM DETECTION] Will use: /api/* endpoints

🔧 FieldNormalizerService: Vercel → /api/openai-proxy
📦 Repository proxy (Vercel): /api/repository-proxy
```

**API-Calls:**
```
POST /api/openai-proxy → 200 OK ✅
POST /api/repository-proxy → 200 OK ✅
GET /api/geocode-proxy → 200 OK ✅
```

### Nach dem Fix (auf Netlify):

**Browser Console sollte zeigen:**
```
✅ [PLATFORM DETECTION] Detected: Netlify (hostname)
🔧 FieldNormalizerService: Netlify → /.netlify/functions/openai-proxy
📦 Repository proxy (Netlify): /.netlify/functions/repository-proxy
```

**API-Calls:**
```
POST /.netlify/functions/openai-proxy → 200 OK ✅
POST /.netlify/functions/repository-proxy → 200 OK ✅
GET /.netlify/functions/photon → 200 OK ✅
```

## 🧪 Testing

### 1. Normalisierung testen

```
1. Text eingeben: "Mathematik-Kurs für Grundschüler"
2. "Extraktion starten" klicken
3. Feld "Bildungsstufe" wird gefüllt mit "grundschule"
4. Feld editieren → "Grndschule" (Typo) eingeben
5. Tab drücken → Normalisierung läuft
6. Sollte korrigiert werden zu "Grundschule" ✅
```

**Console sollte zeigen:**
```
🔧 normalizeValue called for ccm:educationalContext
🔧 FieldNormalizerService: Vercel → /api/openai-proxy
POST /api/openai-proxy → 200 OK
⚡ Local normalization succeeded: "Grndschule" → "Grundschule"
```

### 2. Repository-Submission testen

```
1. Metadaten extrahieren
2. "Als Gast vorschlagen" klicken
3. Sollte erfolgreich submittet werden
```

**Console sollte zeigen:**
```
📦 Repository proxy (Vercel): /api/repository-proxy
📮 Submitting metadata as guest via proxy...
POST /api/repository-proxy (checkDuplicate) → 200 OK
POST /api/repository-proxy (createNode) → 200 OK
✅ Node created
```

## ✅ Checklist

- [x] FieldNormalizerService nutzt Platform-Detection
- [x] GuestSubmissionService nutzt Platform-Detection
- [x] GeocodingService nutzt Platform-Detection (bereits korrekt)
- [x] OpenAIProxyService nutzt Platform-Detection (bereits korrekt)
- [x] Alle Services konsistent

## 🎉 Ergebnis

**Alle Services nutzen jetzt Platform-Detection:**
- ✅ Funktioniert auf Vercel (`/api/*`)
- ✅ Funktioniert auf Netlify (`/.netlify/functions/*`)
- ✅ Dual-Deployment möglich
- ✅ Keine hardcoded Endpunkte mehr

---

**Status:** ✅ Alle Services gefixt  
**Problem:** Normalisierung nutzte hardcoded Netlify-Endpunkte  
**Lösung:** Platform-Detection in allen Services  
**Datum:** 2025-01-19
