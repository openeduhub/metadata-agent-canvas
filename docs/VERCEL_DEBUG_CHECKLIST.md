# 🔧 Vercel Deployment Debug Checklist

## ❌ Aktuelles Problem

Die App auf Vercel versucht immer noch Netlify-Endpunkte zu erreichen:
```
POST https://metadata-agent-canvas.vercel.app/.netlify/functions/openai-proxy
→ 405 (Method Not Allowed)
```

## ✅ Angewandte Fixes

### 1. Platform-Detection aggressiver gemacht
- ✅ Prüft `hostname.includes('vercel')`
- ✅ Prüft `fullUrl.includes('vercel')`
- ✅ Default-Fallback auf Vercel geändert (statt Netlify)
- ✅ Ausführliches Logging hinzugefügt

### 2. Alle Getter haben Vercel-Fallback
- ✅ `getOpenAIProxyUrl()` → `/api/openai-proxy`
- ✅ `getGeocodingProxyUrl()` → `/api/geocode-proxy`
- ✅ `getRepositoryProxyUrl()` → `/api/repository-proxy`

## 🚀 Deployment-Schritte

### 1. Code committen & pushen

```bash
git add .
git commit -m "fix: aggressive Vercel platform detection with fallback"
git push origin main
```

### 2. Vercel Build abwarten

Gehe zu: https://vercel.com/dashboard

**Erwartete Build-Logs:**
```
✓ Running "npm run build:vercel"
✓ Compiled successfully
✓ Build completed
```

### 3. Nach Deployment - HARD REFRESH!

**Wichtig:** Browser-Cache kann alte JS-Files laden!

- **Chrome/Edge:** `Ctrl + Shift + R`
- **Firefox:** `Ctrl + F5`
- **Safari:** `Cmd + Shift + R`

### 4. Console Logs prüfen (F12)

**Erwartete Logs:**
```
🔍 [PLATFORM DETECTION] Starting detection...
🔍 [PLATFORM DETECTION] Hostname: metadata-agent-canvas.vercel.app
🔍 [PLATFORM DETECTION] Full URL: https://metadata-agent-canvas.vercel.app/
✅ [PLATFORM DETECTION] Detected: VERCEL
✅ [PLATFORM DETECTION] Will use: /api/* endpoints
```

**Falls immer noch falsch:**
```
❌ [PLATFORM DETECTION] Could not detect platform!
❌ [PLATFORM DETECTION] Defaulting to VERCEL (/api/*)
```
→ Sollte trotzdem funktionieren (Fallback)

### 5. Network Tab prüfen

**Erwartete Requests:**
```
✅ POST /api/openai-proxy → 200 OK
✅ GET /api/geocode-proxy → 200 OK
✅ POST /api/repository-proxy → 200 OK
```

**Falls immer noch `.netlify/functions/`:**
→ **Cache-Problem!** Siehe Troubleshooting unten

## 🐛 Troubleshooting

### Problem: Immer noch `.netlify/functions/` URLs

**Mögliche Ursachen:**

#### 1. Browser-Cache
```bash
# Lösung 1: Hard Refresh
Ctrl + Shift + R

# Lösung 2: Komplett Cache löschen
Chrome → Settings → Privacy → Clear browsing data → Cached images and files
```

#### 2. Service Worker Cache
```javascript
// In Browser Console:
navigator.serviceWorker.getRegistrations().then(function(registrations) {
  for(let registration of registrations) {
    registration.unregister();
    console.log('Service Worker unregistered');
  }
});
```

#### 3. Vercel Build Cache
```bash
# Vercel Dashboard → Deployments → "..." → Redeploy
# ODER Vercel CLI:
vercel --prod --force
```

#### 4. Code nicht deployed
```bash
# Prüfe letzten Commit:
git log --oneline -1

# Prüfe Vercel Deployment:
# Vercel Dashboard → Deployments → Check Commit Hash
```

### Problem: Console zeigt keine Logs

**Mögliche Ursachen:**

#### 1. Production Build hat keine Logs (Source Maps fehlen)
```javascript
// Manuell testen in Console:
window.location.hostname
// → Sollte "metadata-agent-canvas.vercel.app" sein

window.location.hostname.includes('vercel')
// → Sollte true sein
```

#### 2. Code-Optimierung entfernt Logs
→ Prüfe `angular.json` ob Source Maps enabled sind

### Problem: 405 Error bleibt

**Bedeutet:** Falscher Endpunkt wird weiterhin verwendet

**Debug-Schritte:**

```javascript
// 1. In Browser Console:
console.log('Current hostname:', window.location.hostname);
console.log('Should contain vercel:', window.location.hostname.includes('vercel'));

// 2. Prüfe welche URL tatsächlich verwendet wird:
// Network Tab → Filter "openai-proxy" → Check Request URL

// 3. Falls immer noch .netlify/functions/:
// → Build-Cache-Problem → Force Redeploy auf Vercel
```

## 🧪 Test-Seite

Es gibt eine Test-Seite um die Detection-Logik zu verifizieren:

```
https://metadata-agent-canvas.vercel.app/test-platform-detection.html
```

Diese Seite zeigt:
- Aktuellen Hostname
- Detection-Ergebnis
- Erwarteten API-Endpunkt
- Status (✅/❌)

## 📝 Manuelle Verifikation

Falls automatische Detection fehlschlägt, kannst du manuell prüfen:

```javascript
// In Browser Console auf Vercel-Deployment:
const hostname = window.location.hostname;
console.log('Hostname:', hostname);
console.log('Contains vercel:', hostname.includes('vercel'));
console.log('Expected endpoint:', hostname.includes('vercel') ? '/api/openai-proxy' : '/.netlify/functions/openai-proxy');

// Expected output:
// Hostname: metadata-agent-canvas.vercel.app
// Contains vercel: true
// Expected endpoint: /api/openai-proxy
```

## 🎯 Erfolgs-Kriterien

Nach erfolgreichem Deployment solltest du sehen:

### ✅ Console Logs
```
🔍 [PLATFORM DETECTION] Hostname: metadata-agent-canvas.vercel.app
✅ [PLATFORM DETECTION] Detected: VERCEL
🚀 Production: B-API-OPENAI via Vercel → /api/openai-proxy
```

### ✅ Network Tab
```
POST /api/openai-proxy          200 OK
GET /api/geocode-proxy          200 OK
POST /api/repository-proxy      200 OK
```

### ✅ Funktionalität
- Metadaten-Extraktion funktioniert
- Geocoding funktioniert
- Repository-Upload funktioniert

## 🆘 Falls nichts hilft

### Nuclear Option: Force Rebuild

```bash
# 1. Lokalen Cache löschen
rm -rf node_modules/
rm -rf dist/
rm -rf .angular/

# 2. Neu installieren
npm install

# 3. Lokal testen
npm run build:vercel

# 4. Prüfen dass dist/ existiert und /api-Endpunkte im Code
grep -r "netlify/functions" dist/
# → Sollte NICHTS finden!

# 5. Force Push
git commit --allow-empty -m "trigger rebuild"
git push origin main --force
```

### Kontakt

Falls das Problem weiterhin besteht:
1. Screenshot der Console-Logs
2. Screenshot des Network-Tabs
3. Vercel Deployment-URL
4. Commit-Hash des Deployments

---

**Status:** Fixes implementiert, Deployment ausstehend  
**Nächster Schritt:** Committen, Pushen, Hard Refresh, Testen  
**Datum:** 2025-01-19
