# 🅰️ Angular on Netlify - Integration Guide

**Angular Version:** 19.2.x  
**Deployment:** Netlify mit automatischer Framework Detection

---

## 📋 Übersicht

Dieses Projekt (`webkomponente-canvas`) ist eine **Angular 19 Standalone Web Component** deployed auf Netlify mit:

- ✅ **Automatic Framework Detection**
- ✅ **Netlify Functions** (API-Proxies für OpenAI, B-API, Geocoding)
- ✅ **Environment Variables** (Secrets Controller)
- ✅ **Client-Side Routing** (redirects)
- ✅ **TypeScript** (strict mode)
- ✅ **Material Design**

---

## 🚀 Netlify Framework Detection

### Automatische Konfiguration

Wenn Sie das Repository mit Netlify verbinden, erkennt Netlify automatisch Angular und schlägt vor:

| Setting | Netlify Vorschlag | Aktuell in `package.json` |
|---------|-------------------|---------------------------|
| **Build Command** | `ng build --prod` | `npm run build:prod` → `ng build --configuration production` |
| **Publish Directory** | Auto-detected aus `angular.json` | `dist` |
| **Dev Command** | `ng serve` | `npm start` |
| **Dev Port** | `4200` | `4200` |

**✅ Aktuelle Konfiguration in `netlify.toml`:**

```toml
[build]
  command = "npm run build:prod"
  publish = "dist"

[dev]
  command = "npm start"
  framework = "#custom"
  targetPort = 4200
  port = 8888
```

---

## 🔄 Client-Side Routing & Redirects

### Problem: Angular SPA Router

Angular ist eine **Single-Page Application (SPA)**. Wenn ein User eine URL direkt aufruft (z.B. `https://yourapp.netlify.app/events`), muss Netlify die Anfrage zu `index.html` umleiten, damit Angular das Routing übernimmt.

### Lösung: SPA Fallback Redirect

**✅ Bereits konfiguriert in `netlify.toml`:**

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Was das macht:**
- Alle URL-Pfade (`/*`) werden zu `index.html` weitergeleitet
- Status `200` (nicht `301`/`302`) → URL bleibt in der Browser-Adresszeile
- Angular Router übernimmt das Client-Side Routing

**Alternative: `_redirects` Datei**

Falls Sie `_redirects` bevorzugen:

```
# src/_redirects
/*    /index.html    200
```

Dann in `angular.json` zur `assets` Array hinzufügen:

```json
"assets": [
  "src/assets",
  "src/schemata",
  "src/_redirects"  // ← Neu
]
```

**Hinweis:** Wir nutzen bereits `netlify.toml`, daher ist `_redirects` **nicht nötig**.

---

## 🖼️ Netlify Image CDN & NgOptimizedImage

### Angular's NgOptimizedImage Directive

Angular bietet die **NgOptimizedImage** Directive für optimierte Bilder:

- **Automatisches Lazy Loading**
- **Automatische `srcset` Generierung**
- **LCP (Largest Contentful Paint) Optimierung**
- **Netlify Image CDN** Integration

### Netlify Image CDN Integration

Wenn `NgOptimizedImage` verwendet wird, nutzt es **automatisch Netlify Image CDN** für:

- **On-demand Transformationen** (Resize, Format, Qualität)
- **Content Negotiation** (WebP/AVIF für moderne Browser)
- **Keine Build-Zeit-Kosten** (Bilder werden zur Laufzeit optimiert)

### Setup (Optional - falls Bilder verwendet werden)

**1. NgOptimizedImage importieren:**

```typescript
// app.component.ts oder standalone component
import { NgOptimizedImage } from '@angular/common';

@Component({
  standalone: true,
  imports: [NgOptimizedImage],
  // ...
})
```

**2. Im Template verwenden:**

```html
<!-- Statt <img src="..."> -->
<img 
  ngSrc="assets/logo.png" 
  width="400" 
  height="300" 
  alt="Logo"
  priority  <!-- Für LCP-kritische Bilder -->
>
```

**3. Remote Images (falls externe Domains):**

Falls Sie Bilder von externen Domains laden, konfigurieren Sie `netlify.toml`:

```toml
[images]
  remote_images = [
    "https://cdn.example.com/.*",
    "https://images.unsplash.com/.*"
  ]
```

**Hinweis:** Aktuell nutzt das Projekt keine Bilder, daher ist NgOptimizedImage **optional**.

---

## ⚡ Server-Side Rendering (SSR) - Optional

### Aktueller Status

Das Projekt ist aktuell eine **Client-Side Rendered (CSR) SPA**.

### Falls SSR gewünscht

Angular unterstützt SSR mit **Angular Universal** und Netlify nutzt automatisch **Edge Functions** dafür.

**Setup:**

```bash
ng add @angular/ssr
```

**Netlify erkennt automatisch:**
- SSR-Build Konfiguration
- Erstellt Edge Function für Server-Side Rendering
- Konfiguriert automatisch

**Request/Context Access während SSR:**

```typescript
import type { Context } from "@netlify/edge-functions";

export class MyComponent {
  constructor(
    @Inject('netlify.request') @Optional() request?: Request,
    @Inject('netlify.context') @Optional() context?: Context,
  ) {
    // Zugriff auf Request und Netlify Context
    console.log(`Rendering for ${request?.url} from ${context?.geo?.city}`);
  }
}
```

**Redirects bei SSR:**

⚠️ Bei SSR nutzen **Edge Functions**, die **vor** Redirects ausgeführt werden!

Daher: Nutzen Sie Angular's eingebaute Redirects:
```typescript
// app.routes.ts
export const routes: Routes = [
  { path: 'old-path', redirectTo: 'new-path', pathMatch: 'full' }
];
```

**Hinweis:** Aktuell **nicht implementiert**, da CSR ausreichend ist.

---

## 🔧 Build-Konfiguration

### Angular Build Command

**In `package.json`:**

```json
"scripts": {
  "build:prod": "node replace-env.js && ng build --configuration production"
}
```

**Was passiert:**
1. **`replace-env.js`** läuft vor dem Build (prüft environment files)
2. **`ng build --configuration production`**:
   - Nutzt `environment.prod.ts` (via `fileReplacements` in `angular.json`)
   - Minification & Tree-shaking
   - Output Hashing für Cache-Busting
   - Bundle-Größe: ~2MB (siehe `budgets` in `angular.json`)

### Output Directory

**`angular.json`:**

```json
"outputPath": "dist"
```

**Netlify `netlify.toml`:**

```toml
publish = "dist"
```

**✅ Beide stimmen überein!**

---

## 🔐 Environment Variables & Secrets

### Lokal vs. Production

| Environment | Quelle | Beispiel |
|-------------|--------|----------|
| **Lokal** | `.env` Datei | `OPENAI_API_KEY=sk-proj-...` |
| **Netlify** | Environment Variables (Dashboard/CLI) | `OPENAI_API_KEY=sk-proj-...` (als secret) |

**Frontend (Angular):**
- `apiKey: ''` (leer) in `environment.ts` und `environment.prod.ts`
- Keys werden **NIEMALS** ins Bundle injiziert

**Backend (Netlify Functions):**
- Lesen Keys aus `process.env.OPENAI_API_KEY`
- Fügen Keys server-side zu API-Requests hinzu

📖 **Vollständige Dokumentation:** Siehe `NETLIFY_SECRETS_CONTROLLER.md`

---

## 🌐 Netlify Functions (API Proxies)

### Zweck

Angular Frontend kann nicht direkt API-Keys verwenden (würde im Bundle landen).

**Lösung:** Netlify Functions als Server-Side Proxies.

### Vorhandene Functions

```
netlify/functions/
├── openai-proxy.js      → LLM API (OpenAI, B-API OpenAI, B-API AcademicCloud)
├── photon.js            → Geocoding API
└── repository-proxy.js  → edu-sharing Repository API
```

### Konfiguration

**`netlify.toml`:**

```toml
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
```

### Aufruf aus Angular

**Development (lokal):**
```typescript
// environment.ts
proxyUrl: 'http://localhost:3001/llm'
```

**Production (Netlify):**
```typescript
// environment.prod.ts
proxyUrl: ''  // → Fallback: /.netlify/functions/openai-proxy
```

**Service:**
```typescript
async callLLM(prompt: string) {
  const url = this.proxyUrl || '/.netlify/functions/openai-proxy';
  return this.http.post(url, { messages: [...] });
}
```

---

## 📦 Bundle Size & Performance

### Angular Budgets

**`angular.json`:**

```json
"budgets": [
  {
    "type": "initial",
    "maximumWarning": "2mb",
    "maximumError": "5mb"
  }
]
```

**Aktueller Bundle:**
- ~1.5-2MB (initial bundle)
- Material Design Components
- Angular Runtime
- RxJS

**Optimierungen:**
- ✅ Production Build: Minification, Tree-shaking
- ✅ Output Hashing für Cache-Busting
- ✅ Lazy Loading (falls weitere Module hinzukommen)

### Performance Monitoring

**Netlify Analytics:**
- Verfügbar im Netlify Dashboard
- Zeigt Core Web Vitals (LCP, FID, CLS)

**Lighthouse CI (Optional):**
```bash
npm install -g @lhci/cli
lhci autorun --config=lighthouserc.json
```

---

## 🧪 Local Development mit Netlify Dev

### Option 1: Standard Angular Dev Server

```bash
npm start  # → ng serve (localhost:4200)
```

**Vorteile:**
- Fast Hot Module Replacement (HMR)
- Angular DevTools

**Nachteile:**
- Netlify Functions nicht verfügbar
- Environment Variables aus `.env` müssen manuell geladen werden

### Option 2: Netlify Dev

```bash
npm run dev  # → netlify dev
```

**Vorteile:**
- ✅ Netlify Functions verfügbar (/.netlify/functions/*)
- ✅ Environment Variables aus Netlify Dashboard
- ✅ Simuliert Production-Umgebung

**Nachteile:**
- Etwas langsamer als `ng serve`

**`netlify.toml` Konfiguration:**

```toml
[dev]
  command = "npm start"
  framework = "#custom"
  targetPort = 4200  # Angular Dev Server Port
  port = 8888        # Netlify Dev Proxy Port
```

**Zugriff:**
- Netlify Dev: `http://localhost:8888`
- Angular direkt: `http://localhost:4200`

---

## 🔀 Deployment Workflows

### 1. Git Push → Auto-Deploy

**Netlify CI/CD:**

```bash
git add .
git commit -m "Feature: New metadata fields"
git push origin main
```

**Netlify führt automatisch aus:**
1. `npm install`
2. `npm run build:prod` (inkl. `replace-env.js`)
3. Secret Scanning (falls Secrets Controller aktiv)
4. Deploy zu Production

**Deploy Previews:**
- Für jeden Pull Request
- Eigene Preview-URL
- Environment Variables aus `Deploy Previews` Scope

### 2. Netlify CLI Deploy

```bash
# Build lokal
npm run build:prod

# Deploy zu Draft
netlify deploy

# Deploy zu Production
netlify deploy --prod
```

### 3. Branch Deploys

**In Netlify Dashboard:**
```
Site settings → Build & deploy → Continuous deployment → Branch deploys
```

**Beispiel:**
- `main` → Production
- `develop` → Staging (eigene URL)
- Feature Branches → Deploy Previews

---

## 🛠️ Troubleshooting

### Problem: 404 bei Page Refresh

**Symptom:** Direct URL wie `/events` gibt 404.

**Ursache:** Netlify kennt die Route nicht (Angular CSR).

**Lösung:** Redirects in `netlify.toml` prüfen:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Problem: Build schlägt fehl mit "Budget exceeded"

**Symptom:**
```
Error: bundle size exceeded maximum warning threshold
```

**Lösung:**
```json
// angular.json
"maximumWarning": "3mb",  // ← Erhöhen
"maximumError": "6mb"
```

**Bessere Lösung:** Bundle-Größe reduzieren:
- Lazy Loading für Features
- Tree-shaking prüfen
- Ungenutzte Dependencies entfernen

### Problem: Environment Variables nicht verfügbar

**Symptom:** API-Keys funktionieren nicht in Production.

**Ursache:** Netlify Environment Variables nicht gesetzt.

**Lösung:**
```bash
netlify env:set OPENAI_API_KEY "sk-proj-..." --secret
# Dann: Redeploy triggern
```

### Problem: Netlify Functions Timeout

**Symptom:**
```
Error: Function execution took longer than 10s
```

**Ursache:** LLM API Call dauert zu lange.

**Lösung:**
```toml
# netlify.toml
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
  
# Für Pro/Business Plan:
[functions."openai-proxy"]
  timeout = 30  # 30 Sekunden (max)
```

**Hinweis:** Free Plan = 10s Timeout, Pro/Business = bis 26s Background Functions.

---

## 📊 Best Practices

### ✅ DO's

- ✅ Nutzen Sie `netlify.toml` für Konfiguration (Version Control)
- ✅ Aktivieren Sie Secrets Controller für API-Keys
- ✅ Nutzen Sie Deploy Previews für Testing
- ✅ Konfigurieren Sie Branch Deploys für Staging
- ✅ Prüfen Sie Bundle Size Budgets
- ✅ Nutzen Sie Netlify Functions für Backend-Logic
- ✅ Testen Sie lokal mit `netlify dev`

### ❌ DON'Ts

- ❌ Hardcoden Sie keine API-Keys im Code
- ❌ Committen Sie keine `.env` Dateien
- ❌ Überschreiten Sie Bundle Size Budgets
- ❌ Verwenden Sie keine Client-Side API-Calls mit Keys
- ❌ Deaktivieren Sie nicht Secret Scanning

---

## 🔗 Weiterführende Links

### Netlify Dokumentation

- **Angular on Netlify:** https://docs.netlify.com/frameworks/angular/
- **Environment Variables:** https://docs.netlify.com/environment-variables/overview/
- **Netlify Functions:** https://docs.netlify.com/functions/overview/
- **Redirects:** https://docs.netlify.com/routing/redirects/
- **Image CDN:** https://docs.netlify.com/image-cdn/overview/

### Angular Dokumentation

- **NgOptimizedImage:** https://angular.dev/guide/image-optimization
- **Angular Universal (SSR):** https://angular.dev/guide/ssr
- **Deployment:** https://angular.dev/tools/cli/deployment

### Projekt-spezifische Dokumentation

- **Netlify Secrets Controller:** `NETLIFY_SECRETS_CONTROLLER.md`
- **Quick Start:** `QUICKSTART_NETLIFY_SECRETS.md`
- **Security Architecture:** `SECURITY_ARCHITECTURE.md`
- **Environment Variables:** `ENVIRONMENT_VARIABLES.md`

---

## 📋 Deployment Checklist (Angular-spezifisch)

**Vor jedem Production Deploy:**

- [ ] `angular.json` korrekt konfiguriert (outputPath, assets, budgets)
- [ ] `netlify.toml` hat `publish = "dist"`
- [ ] Redirects konfiguriert (`from = "/*"` to `index.html`)
- [ ] Build Command: `npm run build:prod` in `netlify.toml`
- [ ] Netlify Functions in `netlify/functions/` vorhanden
- [ ] Environment Variables gesetzt (als secrets markiert)
- [ ] Bundle Size innerhalb Budgets (`ng build --configuration production`)
- [ ] Lokal getestet mit `netlify dev`
- [ ] Deploy Preview geprüft (bei PR)
- [ ] Production Bundle auf Leaks geprüft (Secret Scanning)

---

## 🎯 Zusammenfassung

```
┌──────────────────────────────────────────────────────────┐
│  Angular 19 Standalone App                               │
│  • TypeScript (strict mode)                              │
│  • Material Design                                       │
│  • Client-Side Rendering (CSR)                           │
└───────────────────┬──────────────────────────────────────┘
                    │
                    │ npm run build:prod
                    │ (replace-env.js + ng build)
                    ▼
┌──────────────────────────────────────────────────────────┐
│  Netlify Build                                           │
│  • Automatic Framework Detection                         │
│  • Secret Scanning (prevents leaks)                      │
│  • Bundle Size Check                                     │
└───────────────────┬──────────────────────────────────────┘
                    │
                    │ Publish: dist/
                    ▼
┌──────────────────────────────────────────────────────────┐
│  Netlify Production                                      │
│  • SPA Fallback Redirects (/* → /index.html)            │
│  • Netlify Functions (/.netlify/functions/*)             │
│  • Environment Variables (Secrets Controller)            │
│  • Edge Network (Global CDN)                             │
└──────────────────────────────────────────────────────────┘
```

---

**Stand:** Januar 2025  
**Angular Version:** 19.2.x  
**Netlify CLI:** 17.x+
