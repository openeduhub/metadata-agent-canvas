# 🎯 Platform Configuration Guide

## Übersicht

Die Metadata-Canvas Webkomponente unterstützt **explizite Platform-Konfiguration** über Build-Time Environment Variables. Dies ist **zuverlässiger** als Runtime-Detection und eliminiert potenzielle Fehlerquellen.

## 🏗️ Build-Konfigurationen

### Verfügbare Konfigurationen

| Konfiguration | Environment File | Deployment Platform | API Endpunkte |
|---------------|------------------|---------------------|---------------|
| **vercel** | `environment.vercel.ts` | Vercel | `/api/*` |
| **netlify** | `environment.netlify.ts` | Netlify | `/.netlify/functions/*` |
| **production** | `environment.prod.ts` | Auto-detect | Hostname-basiert |
| **development** | `environment.ts` | Local | `http://localhost:3001/*` |

### Build Commands

```bash
# Vercel-spezifischer Build
npm run build:vercel

# Netlify-spezifischer Build  
npm run build:netlify

# Generischer Production Build (auto-detect)
npm run build:prod

# Development Build
npm run build:dev
```

## 📋 Environment Files

### `environment.vercel.ts` (Vercel Deployment)

```typescript
export const environment = {
  production: true,
  deploymentPlatform: 'vercel',  // ← Explizit gesetzt
  // ...
};
```

**Features:**
- ✅ `deploymentPlatform: 'vercel'` explizit gesetzt
- ✅ Keine Runtime-Detection nötig
- ✅ Verwendet `/api/openai-proxy`, `/api/geocode-proxy`, `/api/repository-proxy`

### `environment.netlify.ts` (Netlify Deployment)

```typescript
export const environment = {
  production: true,
  deploymentPlatform: 'netlify',  // ← Explizit gesetzt
  // ...
};
```

**Features:**
- ✅ `deploymentPlatform: 'netlify'` explizit gesetzt
- ✅ Verwendet `/.netlify/functions/openai-proxy`, `/.netlify/functions/photon`, etc.

### `environment.prod.ts` (Generic Production)

```typescript
export const environment = {
  production: true,
  deploymentPlatform: 'auto',  // ← Fallback zu Runtime-Detection
  // ...
};
```

**Features:**
- ✅ `deploymentPlatform: 'auto'` für Runtime-Detection
- ✅ Prüft Hostname zur Laufzeit
- ✅ Fallback zu Vercel bei Unknown

### `environment.ts` (Local Development)

```typescript
export const environment = {
  production: false,
  deploymentPlatform: 'local',
  // ...
};
```

## 🎯 Platform-Detection-Prioritäten

Die `PlatformDetectionService` verwendet folgende **Prioritäten**:

### 1. Environment Variable (Build-Time) 🥇

```typescript
// Wenn environment.deploymentPlatform gesetzt ist:
if (envPlatform && envPlatform !== 'auto') {
  this.platform = envPlatform;  // ✅ VERWENDET
  console.log('Set via environment.ts: VERCEL');
}
```

### 2. Runtime Hostname Detection 🥈

```typescript
// Wenn deploymentPlatform = 'auto':
if (hostname.includes('vercel.app')) {
  this.platform = 'vercel';
}
```

### 3. Default Fallback 🥉

```typescript
// Falls Detection fehlschlägt:
this.platform = 'vercel';  // Sicherer Fallback
```

## 🚀 Deployment-Szenarien

### Szenario 1: Vercel Deployment (EMPFOHLEN)

**Vercel Project Settings:**
```
Build Command: npm run build:vercel
Output Directory: dist
```

**Erwartetes Verhalten:**
```
🔍 [PLATFORM DETECTION] Starting detection...
✅ [PLATFORM DETECTION] Set via environment.ts: VERCEL
✅ [PLATFORM DETECTION] Will use: /api endpoints
```

**API Calls:**
```
POST /api/openai-proxy → 200 OK
GET /api/geocode-proxy → 200 OK
POST /api/repository-proxy → 200 OK
```

### Szenario 2: Netlify Deployment

**netlify.toml:**
```toml
[build]
  command = "npm run build:netlify"
  publish = "dist"
```

**Erwartetes Verhalten:**
```
🔍 [PLATFORM DETECTION] Starting detection...
✅ [PLATFORM DETECTION] Set via environment.ts: NETLIFY
✅ [PLATFORM DETECTION] Will use: /.netlify/functions endpoints
```

**API Calls:**
```
POST /.netlify/functions/openai-proxy → 200 OK
GET /.netlify/functions/photon → 200 OK
POST /.netlify/functions/repository-proxy → 200 OK
```

### Szenario 3: Generic Deployment (Auto-Detect)

**Build Command:**
```bash
npm run build:prod
```

**Verhalten:**
```
🔍 [PLATFORM DETECTION] Environment: auto-detect
🔍 [PLATFORM DETECTION] Hostname: your-domain.com
```

- Prüft `hostname.includes('vercel')` → Vercel
- Prüft `hostname.includes('netlify')` → Netlify
- Fallback → Vercel

## 🔧 Troubleshooting

### Problem: Falsche Endpunkte trotz build:vercel

**Ursache:** Build-Cache oder falscher Build-Command

**Lösung:**
```bash
# 1. Prüfe Build-Command in Vercel Dashboard
# Sollte sein: npm run build:vercel

# 2. Force Redeploy
vercel --prod --force

# 3. Lokal prüfen
npm run build:vercel
grep -r "deploymentPlatform" dist/
# Sollte: "vercel" finden
```

### Problem: Console zeigt "auto-detect" statt "VERCEL"

**Ursache:** Falscher Build-Command verwendet

**Lösung:**
```bash
# Prüfe welcher Build lief:
# In dist/main.*.js sollte stehen:
# deploymentPlatform:"vercel"  ← RICHTIG
# deploymentPlatform:"auto"    ← FALSCH

# Fix: Verwende korrekten Build-Command
npm run build:vercel  # Nicht build:prod!
```

### Problem: Beide Plattformen nutzen gleichen Code

**Lösung:** Das ist gewollt! Du kannst:

**Option A: Separate Branches**
```bash
# Branch für Vercel
git checkout vercel-main
# Vercel Dashboard: Deploy from branch "vercel-main"

# Branch für Netlify  
git checkout netlify-main
# Netlify Dashboard: Deploy from branch "netlify-main"
```

**Option B: Build-Command in Platform Settings**
```
Vercel: npm run build:vercel
Netlify: npm run build:netlify
```

## 📊 Vergleich der Ansätze

| Ansatz | Zuverlässigkeit | Wartung | Flexibilität |
|--------|----------------|---------|--------------|
| **Environment Variable** (NEU) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Runtime Hostname Detection | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Default Fallback | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |

### Vorteile Environment Variable Ansatz

✅ **Build-Time Resolution** - Keine Runtime-Detection nötig  
✅ **Zero Ambiguity** - Kein Raten basierend auf Hostname  
✅ **Debuggable** - Einfach zu prüfen welche Config gebaut wurde  
✅ **Predictable** - Gleiches Verhalten bei jedem Build  
✅ **Testable** - Lokal exakte Production-Config nachbauen  

## 🧪 Testing

### Test 1: Prüfe Build-Artefakte

```bash
# Vercel Build
npm run build:vercel

# Prüfe Config
cat dist/main.*.js | grep -o "deploymentPlatform:\"[^\"]*\""
# Erwartete Ausgabe: deploymentPlatform:"vercel"
```

### Test 2: Console Logs nach Deployment

```javascript
// Öffne Browser Console (F12)
// Erwartete Logs:
✅ [PLATFORM DETECTION] Set via environment.ts: VERCEL
✅ [PLATFORM DETECTION] Will use: /api endpoints
```

### Test 3: Network Tab

```
Filter: "proxy"
Erwartete Requests:
- POST /api/openai-proxy (Vercel)
- POST /.netlify/functions/openai-proxy (Netlify)
```

## 📝 Best Practices

### 1. Verwende spezifische Build-Commands

```toml
# vercel.json
{
  "buildCommand": "npm run build:vercel"
}

# netlify.toml
[build]
  command = "npm run build:netlify"
```

### 2. Prüfe Build-Artefakte

```bash
# Nach jedem Build:
npm run build:vercel
grep deploymentPlatform dist/main.*.js
```

### 3. Dokumentiere Platform-Spezifika

```typescript
// In Code-Kommentaren:
// NOTE: This endpoint is different on Netlify (/photon vs /geocode-proxy)
```

### 4. Teste auf Target-Platform

```bash
# Lokaler Build-Test für Vercel:
npm run build:vercel
npx serve dist

# Browser: http://localhost:3000
# Console: Sollte "VERCEL" zeigen (nicht "local")
```

## 🎉 Zusammenfassung

Mit der neuen **Environment-basierten Platform-Konfiguration**:

✅ **Keine Runtime-Detection-Fehler** mehr  
✅ **Explizite Platform-Angabe** im Build  
✅ **Debuggable** und **Predictable**  
✅ **Fallback zu Auto-Detect** für Kompatibilität  

**Empfohlene Commands:**
- Vercel: `npm run build:vercel`
- Netlify: `npm run build:netlify`
- Generic: `npm run build:prod` (auto-detect)

---

**Status:** ✅ Implementiert  
**Version:** 2.0 (Environment-basiert)  
**Datum:** 2025-01-19
