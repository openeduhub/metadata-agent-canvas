# 🚀 Dual-Deployment Guide - Vercel & Netlify

## Ziel

**Gleicher Code, zwei Plattformen:**
- Main Branch → Netlify
- Main Branch → Vercel
- Keine Code-Änderungen zwischen Deployments

## ✅ Empfohlene Lösung: Auto-Detection (Runtime)

### Funktionsweise

**`environment.prod.ts`:**
```typescript
deploymentPlatform: 'auto'  // Runtime hostname detection
```

**Platform-Detection zur Runtime:**
1. App startet im Browser
2. Prüft `window.location.hostname`
3. Erkennt Platform:
   - `.vercel.app` → Vercel → `/api/*`
   - `.netlify.app` → Netlify → `/.netlify/functions/*`
   - `localhost` → Local → `http://localhost:3001/*`

### Vorteile

✅ **Dual-Deployment:** Gleicher Code auf beiden Plattformen  
✅ **Zero Config:** Keine Environment Variables nötig  
✅ **Single Branch:** Beide Plattformen deployen von `main`  
✅ **Automatisch:** Detection läuft zur Runtime  

### Vercel Setup

```
Vercel Dashboard:
→ Import Git Repository
→ Branch: main
→ Build Command: npm run build
→ Environment Variables:
   - B_API_KEY
   - LLM_PROVIDER
```

### Netlify Setup

```
Netlify Dashboard:
→ Import Git Repository
→ Branch: main
→ Build Command: npm run build
→ Environment Variables:
   - B_API_KEY
   - LLM_PROVIDER
```

**Das war's!** Beide deployen von `main`, Detection läuft automatisch.

## 📋 Alternative Lösungen (falls Auto-Detection nicht funktioniert)

### Option 1: Build-Command mit Environment Variable

**Vercel Dashboard → Settings → Build & Development:**
```bash
DEPLOYMENT_PLATFORM=vercel npm run build
```

**Netlify netlify.toml:**
```toml
[build]
  command = "DEPLOYMENT_PLATFORM=netlify npm run build"
```

**Vorteile:**
- ✅ Explizite Platform-Angabe
- ✅ Funktioniert auch wenn Hostname nicht erkannt wird
- ✅ Single Branch möglich

**Nachteile:**
- ⚠️ Muss auf beiden Plattformen konfiguriert werden
- ⚠️ Variable wird inline gesetzt (nicht via Dashboard)

### Option 2: Separate Branches

```bash
# Branch für Netlify
git checkout -b netlify-deploy
# environment.prod.ts: deploymentPlatform: 'netlify'
git commit -am "Netlify: hardcode platform"

# Branch für Vercel
git checkout -b vercel-deploy  
# environment.prod.ts: deploymentPlatform: 'vercel'
git commit -am "Vercel: hardcode platform"

# Main bleibt mit 'auto'
git checkout main
```

**Vercel:** Deploy from branch `vercel-deploy`  
**Netlify:** Deploy from branch `netlify-deploy`

**Vorteile:**
- ✅ 100% zuverlässig
- ✅ Keine Runtime-Detection nötig
- ✅ Klar getrennt

**Nachteile:**
- ❌ Separate Branches zu pflegen
- ❌ Changes müssen in beide Branches gemerged werden

### Option 3: Separate Build-Konfigurationen (angular.json)

**Erstelle Platform-spezifische Configs:**

```json
// angular.json
"configurations": {
  "production": {
    "fileReplacements": [{
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.prod.ts"
    }]
  },
  "vercel": {
    "fileReplacements": [{
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.vercel.ts"
    }]
  },
  "netlify": {
    "fileReplacements": [{
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.netlify.ts"
    }]
  }
}
```

**Environment Files:**
```typescript
// environment.vercel.ts
export const environment = {
  production: true,
  deploymentPlatform: 'vercel',
  // ...
};

// environment.netlify.ts  
export const environment = {
  production: true,
  deploymentPlatform: 'netlify',
  // ...
};
```

**Build Commands:**
- Vercel: `ng build --configuration vercel`
- Netlify: `ng build --configuration netlify`

**Vorteile:**
- ✅ Sauber über Angular-Konfiguration
- ✅ Single Branch
- ✅ Platform-spezifische Settings möglich

**Nachteile:**
- ⚠️ Mehr Dateien (environment.vercel.ts, environment.netlify.ts)
- ⚠️ Build-Command muss angepasst werden

## 🎯 Empfehlung

### Für 99% der Fälle:

**✅ Nutze Auto-Detection (Runtime)**
```typescript
deploymentPlatform: 'auto'
```

**Warum?**
- Einfachste Lösung
- Funktioniert out-of-the-box
- Keine Config nötig
- Single Branch, Zero Hassle

### Falls Auto-Detection nicht funktioniert:

**✅ Option 1: Build-Command mit ENV Variable**

Einfach, explizit, funktioniert.

### Falls du volle Kontrolle brauchst:

**✅ Option 2: Separate Branches**

100% zuverlässig, aber mehr Maintenance.

## 🔧 Debug: Auto-Detection prüfen

### Browser Console nach Deployment öffnen:

**Vercel sollte zeigen:**
```
🔍 [PLATFORM DETECTION] Starting detection...
🔍 [PLATFORM DETECTION] Environment: auto-detect
🔍 [PLATFORM DETECTION] Hostname: your-app.vercel.app
✅ [PLATFORM DETECTION] Detected: VERCEL (hostname)
   Hostname: your-app.vercel.app
✅ [PLATFORM DETECTION] Will use: /api/* endpoints
```

**Netlify sollte zeigen:**
```
🔍 [PLATFORM DETECTION] Starting detection...
🔍 [PLATFORM DETECTION] Environment: auto-detect
🔍 [PLATFORM DETECTION] Hostname: your-app.netlify.app
✅ [PLATFORM DETECTION] Detected: Netlify (hostname)
   Hostname: your-app.netlify.app
✅ [PLATFORM DETECTION] Will use: /.netlify/functions/* endpoints
```

### Falls falsche Platform erkannt wird:

**Prüfe Hostname:**
```javascript
console.log(window.location.hostname);
```

**Sollte sein:**
- Vercel: `something.vercel.app` oder `something.vercel.com`
- Netlify: `something.netlify.app`

**Falls Custom Domain:**
- Prüfe ob `__VERCEL__` oder Scripts mit "netlify" existieren

## ✅ Aktuelle Implementierung

**Status:** Auto-Detection implementiert mit verbesserter Vercel/Netlify Erkennung

**Dateien:**
- ✅ `environment.prod.ts` - `deploymentPlatform: 'auto'`
- ✅ `platform-detection.service.ts` - Verbesserte Runtime-Detection
- ✅ Beide Plattformen können von `main` deployen

**Nächster Schritt:**
1. Commit & Push
2. Beide Plattformen deployen
3. Browser Console prüfen
4. Falls Probleme: Option 1 (Build-Command) nutzen

---

**Zusammenfassung:**  
✅ **Auto-Detection ist die beste Lösung für Dual-Deployment**  
✅ **Single Branch, Zero Config, Just Works™**  
⚠️ **Falls nicht: Build-Command mit ENV Variable als Backup**  

**Datum:** 2025-01-19  
**Empfehlung:** Auto-Detection (Runtime)
