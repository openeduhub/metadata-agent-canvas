# 🔧 Vercel Build Environment Variable Fix

## ❌ Problem

Environment Variables sind auf Vercel nicht beim **Build** verfügbar, nur zur **Runtime**.

**Symptom:**
```
POST https://your-app.vercel.app/.netlify/functions/openai-proxy
→ 405 Method Not Allowed
```

Obwohl `DEPLOYMENT_PLATFORM=vercel` in Vercel Environment Variables gesetzt ist!

**Ursache:**
Die Variable wird zur Build-Zeit nicht gelesen → `inject-platform-env.js` sieht sie nicht → Nutzt Fallback `'auto'` → Erkennt Netlify-Hostname (falsch!)

## ✅ Lösung: Environment Variables für Build freischalten

### Schritt 1: Vercel Dashboard öffnen

```
https://vercel.com/your-account/your-project/settings/environment-variables
```

### Schritt 2: DEPLOYMENT_PLATFORM Variable prüfen

**Aktuell (falsch):**
```
Name:  DEPLOYMENT_PLATFORM
Value: vercel
Environments: ✅ Production ✅ Preview ❌ Development
```

**Problem:** Die Variable ist nur für **Runtime** verfügbar, nicht für **Build-Zeit**!

### Schritt 3: Variable für Build freischalten

**Option A: Expose to Build (Empfohlen)**

Vercel hat möglicherweise keine "Expose to Build" Option im UI.

**Option B: Prefix mit NEXT_PUBLIC_ (funktioniert nicht bei Angular)**

Vercel behandelt nur `NEXT_PUBLIC_*` Variables als Build-Zeit Variables (Next.js spezifisch).

**Option C: Hardcode Platform in Build (Workaround)**

Setze `DEPLOYMENT_PLATFORM` direkt im Build-Command:

1. Vercel Dashboard → Settings → General
2. Finde "Build Command"
3. Ändere von:
   ```
   npm run build
   ```
   zu:
   ```
   DEPLOYMENT_PLATFORM=vercel npm run build
   ```

### Schritt 4: Redeploy

```bash
git commit --allow-empty -m "Force redeploy with build-time env"
git push origin main
```

## 🎯 Alternative Lösung: Feste Vercel-Konfiguration

Da du weißt dass du auf Vercel deployest, kannst du die Platform auch **hardcoded** setzen:

### Option 1: Direkt in environment.prod.ts

```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  deploymentPlatform: 'vercel',  // ← Hardcoded für Vercel
  // ...
};
```

**Vorteile:**
- ✅ Funktioniert sofort
- ✅ Keine Build-Command-Änderung nötig
- ✅ Zuverlässig

**Nachteile:**
- ❌ Wenn du auf Netlify wechseln willst, musst du Code ändern

### Option 2: Separater Vercel-Branch

```bash
# Branch für Vercel
git checkout -b vercel-deploy

# Ändere environment.prod.ts:
deploymentPlatform: 'vercel'

# Commit
git commit -am "Hardcode vercel platform"

# Vercel: Deploy from branch "vercel-deploy"
```

**Vorteile:**
- ✅ Hauptbranch bleibt platform-agnostisch
- ✅ Netlify kann von `main` deployen
- ✅ Vercel von `vercel-deploy`

## 🧪 Verifizierung

Nach dem Fix sollte die Console zeigen:

```
✅ [PLATFORM DETECTION] Set via environment.ts: VERCEL
✅ [PLATFORM DETECTION] Will use: /api endpoints
```

Und die API-Calls sollten gehen zu:
```
POST /api/openai-proxy → 200 OK
```

## 📋 Quick Fix Commands

### Variante 1: Build-Command ändern (Vercel Dashboard)

```
Settings → General → Build Command:
DEPLOYMENT_PLATFORM=vercel npm run build
```

### Variante 2: Hardcode in environment.prod.ts

```typescript
deploymentPlatform: 'vercel',
```

### Variante 3: Vercel-spezifische Environment File

Erstelle `src/environments/environment.vercel.ts`:

```typescript
export const environment = {
  production: true,
  deploymentPlatform: 'vercel',
  // ... rest gleich wie environment.prod.ts
};
```

Dann in `angular.json`:

```json
"configurations": {
  "production": { ... },
  "vercel": {
    "fileReplacements": [{
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.vercel.ts"
    }],
    "outputHashing": "all"
  }
}
```

Und Build-Command auf Vercel:

```
ng build --configuration vercel
```

## 🎉 Empfehlung

**Für Single-Platform Deployment (nur Vercel):**
→ **Hardcode `deploymentPlatform: 'vercel'` in environment.prod.ts**

**Für Multi-Platform Deployment (Vercel UND Netlify):**
→ **Separate Branches mit hardcoded Platform**
→ **Oder** Build-Command mit `DEPLOYMENT_PLATFORM=vercel`

---

**Status:** ⚠️ Vercel unterstützt Environment Variables zur Build-Zeit nicht wie erwartet  
**Quick Fix:** Hardcode Platform oder nutze Build-Command Prefix  
**Datum:** 2025-01-19
