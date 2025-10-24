# 🎯 Environment Variable Priority System

## Übersicht

Das System nutzt eine **klare Prioritätshierarchie** für die `DEPLOYMENT_PLATFORM` Variable:

```
1. Environment Variable (höchste Priorität)
   ↓
2. .env File (lokale Entwicklung)
   ↓
3. Hardcoded in environment.ts/prod.ts (Fallback)
```

## 🥇 Priorität 1: Environment Variable (Build-Zeit)

### Vercel

**Vercel Dashboard → Settings → Environment Variables:**

```
DEPLOYMENT_PLATFORM = vercel
```

**Was passiert:**
1. Vercel Build liest `DEPLOYMENT_PLATFORM=vercel` aus Environment
2. `inject-platform-env.js` injiziert `vercel` in `environment.prod.ts`
3. Build nutzt `vercel` (nicht den Wert aus der Datei)

### Netlify

**Netlify Dashboard → Environment Variables:**

```
DEPLOYMENT_PLATFORM = netlify
```

**Oder via CLI:**

```bash
netlify env:set DEPLOYMENT_PLATFORM "netlify"
```

**Was passiert:**
1. Netlify Build liest `DEPLOYMENT_PLATFORM=netlify` aus Environment
2. `inject-platform-env.js` injiziert `netlify` in `environment.prod.ts`
3. Build nutzt `netlify` (nicht den Wert aus der Datei)

## 🥈 Priorität 2: .env File (Lokal)

### Lokale Entwicklung

**`.env` erstellen:**

```bash
cp .env.example .env
```

**`.env` editieren:**

```bash
# Für lokale Entwicklung
DEPLOYMENT_PLATFORM=local

# Für lokales Testen der Vercel-Config
DEPLOYMENT_PLATFORM=vercel

# Für lokales Testen der Netlify-Config
DEPLOYMENT_PLATFORM=netlify
```

**Was passiert:**

```bash
npm run build
# → dotenv lädt .env
# → DEPLOYMENT_PLATFORM wird aus .env gelesen
# → inject-platform-env.js nutzt diesen Wert
# → Build nutzt Wert aus .env
```

**Wichtig:**
- `.env` wird NICHT ins Git committed (in `.gitignore`)
- Jeder Entwickler hat eigenes `.env`
- Environment Variables überschreiben `.env`!

## 🥉 Priorität 3: Hardcoded Wert (Fallback)

### environment.ts (Local Dev)

```typescript
export const environment = {
  production: false,
  deploymentPlatform: 'local',  // ← Fallback für Dev
  // ...
};
```

### environment.prod.ts (Production)

```typescript
export const environment = {
  production: true,
  deploymentPlatform: 'auto',  // ← Fallback (runtime detection)
  // ...
};
```

**Wann wird der Fallback genutzt?**

- Wenn **keine** Environment Variable gesetzt ist
- Wenn **kein** `.env` File existiert
- Als **Sicherheitsnetz** falls etwas schief geht

## 🔍 Wie funktioniert die Injection?

### Build-Prozess:

```
1. npm run build
   ↓
2. build-with-platform.js
   ↓
3. inject-platform-env.js
   |
   ├─→ Liest DEPLOYMENT_PLATFORM aus:
   |   - process.env (Vercel/Netlify/CI)
   |   - .env file (lokal)
   |   - Default: 'auto'
   |
   └─→ Ersetzt Wert in environment.prod.ts:
       deploymentPlatform: 'auto'
       ↓
       deploymentPlatform: 'vercel'  (aus ENV Variable)
   ↓
4. ng build --configuration production
   ↓
5. dist/ (mit injiziertem Wert)
```

## ✅ Prioritäts-Tests

### Test 1: ENV Variable überschreibt .env

**Setup:**
```bash
# .env
DEPLOYMENT_PLATFORM=local
```

**Command:**
```bash
# Überschreibe mit ENV Variable
DEPLOYMENT_PLATFORM=vercel npm run build
```

**Erwartetes Ergebnis:**
```
✅ Source: Environment Variable (Vercel/Netlify/CI)
📦 Value: vercel  ← ENV Variable hat Vorrang!
```

### Test 2: .env überschreibt hardcoded

**Setup:**
```bash
# .env
DEPLOYMENT_PLATFORM=netlify
```

**environment.prod.ts:**
```typescript
deploymentPlatform: 'auto',  // ← wird ignoriert
```

**Command:**
```bash
npm run build
```

**Erwartetes Ergebnis:**
```
✅ Source: .env file (local)
📦 Value: netlify  ← .env hat Vorrang!
```

### Test 3: Fallback wenn nichts gesetzt

**Setup:**
```bash
# Kein .env File
# Keine ENV Variable
```

**environment.prod.ts:**
```typescript
deploymentPlatform: 'auto',  // ← wird genutzt
```

**Command:**
```bash
npm run build
```

**Erwartetes Ergebnis:**
```
⚠️  Not set - using default: auto
```

## 🐛 Troubleshooting

### Problem: ENV Variable wird ignoriert

**Symptom:**
```bash
# Gesetzt:
DEPLOYMENT_PLATFORM=vercel

# Build zeigt:
📦 Value: local  ← Falsch!
```

**Ursache:** ENV Variable nicht exportiert

**Fix:**
```bash
# Windows PowerShell:
$env:DEPLOYMENT_PLATFORM="vercel"
npm run build

# Windows CMD:
set DEPLOYMENT_PLATFORM=vercel
npm run build

# Linux/Mac:
export DEPLOYMENT_PLATFORM=vercel
npm run build
```

### Problem: .env wird ignoriert

**Symptom:**
```bash
# .env enthält:
DEPLOYMENT_PLATFORM=local

# Build zeigt:
📦 Value: auto  ← Default statt .env
```

**Ursache:** Syntax-Fehler in .env oder falscher Pfad

**Fix:**
```bash
# Prüfe .env Syntax (keine Spaces um =)
cat .env | grep DEPLOYMENT_PLATFORM
# Richtig: DEPLOYMENT_PLATFORM=local
# Falsch:  DEPLOYMENT_PLATFORM = local

# Prüfe ob .env im Root liegt
ls .env
```

### Problem: Hardcoded Wert wird genutzt trotz ENV Variable

**Symptom:**
```bash
# ENV Variable gesetzt
# Aber Build nutzt hardcoded 'auto'
```

**Ursache:** `inject-platform-env.js` wurde nicht ausgeführt

**Fix:**
```bash
# Prüfe Build-Script
cat package.json | grep "\"build\""

# Sollte sein:
"build": "node build-with-platform.js"

# NICHT:
"build": "ng build --configuration production"
```

## 📋 Best Practices

### 1. Setze ENV Variable explizit auf Platforms

```bash
# Vercel Dashboard
DEPLOYMENT_PLATFORM=vercel

# Netlify Dashboard
DEPLOYMENT_PLATFORM=netlify
```

→ **Nicht** auf Auto-Detection verlassen!

### 2. Nutze .env für lokale Entwicklung

```bash
# .env (nicht committed)
DEPLOYMENT_PLATFORM=local
B_API_KEY=your-dev-key
```

→ Jeder Entwickler eigene Keys

### 3. Dokumentiere im Projekt

```markdown
## Setup

1. `cp .env.example .env`
2. Editiere `.env` mit deinen Keys
3. Setze `DEPLOYMENT_PLATFORM=local`
```

### 4. Prüfe Build-Logs

```bash
npm run build

# Sollte zeigen:
✅ Source: .env file (local)
📦 Value: local
```

## 🎯 Zusammenfassung

| Quelle | Priorität | Use Case |
|--------|-----------|----------|
| **ENV Variable** | 🥇 Höchste | Vercel/Netlify/CI |
| **`.env` File** | 🥈 Mittel | Lokale Entwicklung |
| **Hardcoded** | 🥉 Fallback | Sicherheitsnetz |

**Regel:**
> Environment Variables und .env Files haben **immer Vorrang** vor hardcodierten Werten!

**Warum?**
- ✅ Flexibilität ohne Code-Änderungen
- ✅ Unterschiedliche Configs pro Entwickler
- ✅ Sicherheit (Keys nicht im Code)
- ✅ Platform-spezifische Deployments

---

**Status:** ✅ Prioritätssystem implementiert  
**Wichtig:** ENV Variable > .env > Hardcoded  
**Datum:** 2025-01-19
