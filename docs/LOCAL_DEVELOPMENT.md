# 🔧 Lokale Entwicklung ohne Netlify CLI

## ✅ Neue hybride Lösung

Die App funktioniert jetzt in **zwei Modi**:

### 1. Development Mode (lokal, Port 4200)
- ✅ Verwendet `npm start`
- ✅ **Direkter** OpenAI API-Zugriff aus dem Browser
- ✅ Kein Netlify CLI erforderlich
- ⚠️ API-Key im Browser sichtbar (nur für lokale Entwicklung OK!)

### 2. Production Mode (Netlify)
- ✅ Verwendet Netlify Function Proxy
- ✅ API-Key bleibt serverseitig (sicher)
- ✅ Keine CORS-Probleme

---

## 🚀 Lokale Entwicklung starten

### Schritt 1: API-Key in environment.ts eintragen

**Datei:** `src/environments/environment.ts`

```typescript
export const environment = {
  production: false,
  
  openai: {
    apiKey: 'sk-proj-...', // Ihren echten API-Key hier eintragen
    model: 'gpt-4o-mini',
    // ...
  }
};
```

### Schritt 2: App starten

```bash
npm start
```

Die App läuft auf **http://localhost:4200**

### Schritt 3: Testen

Öffnen Sie die Browser-Konsole, Sie sollten sehen:
```
🔧 Development mode: Using direct OpenAI API access (no proxy)
```

Das bedeutet: Die App ruft OpenAI **direkt** auf (kein Proxy, kein CORS-Problem).

---

## 🔒 Sicherheit

### Development (lokal)
```typescript
// environment.ts (in .gitignore, wird NICHT committed)
apiKey: 'sk-proj-...' // Echter Key für lokale Tests
```

**Status:** ✅ Sicher, weil in `.gitignore`

### Production (Netlify)
```typescript
// environment.prod.ts (wird committed)
apiKey: '' // Leer!
```

**Netlify Environment Variable:**
```
OPENAI_API_KEY=sk-proj-...
```

**Status:** ✅ Sicher, Key nur auf dem Server

---

## 🎯 Wie funktioniert die Auto-Erkennung?

**Im Code** (`openai-proxy.service.ts`):

```typescript
// Prüft automatisch:
this.useDirectAccess = !environment.production && !!environment.openai.apiKey;

// Wenn Development + API-Key vorhanden → Direkt
// Wenn Production ODER kein API-Key → Netlify Proxy
```

**Entscheidungslogik:**

| Modus | production | apiKey | Verhalten |
|-------|-----------|--------|-----------|
| Lokal | `false` | ✅ Vorhanden | Direkter API-Zugriff |
| Lokal | `false` | ❌ Leer | Fehler (Key erforderlich) |
| Netlify | `true` | egal | Netlify Function Proxy |

---

## 📦 Build für Netlify

### Schritt 1: Sicherstellen dass environment.prod.ts leer ist

```typescript
// src/environments/environment.prod.ts
apiKey: '' // MUSS leer sein!
```

### Schritt 2: Build

```bash
npm run build
```

### Schritt 3: Deploy

```bash
git add .
git commit -m "Update: Hybrid local/production solution"
git push
```

Netlify baut automatisch und verwendet die Netlify Function.

---

## 🔄 Vergleich: Vorher vs. Nachher

### Vorher (CORS-Fehler)
```
Browser → OpenAI API ❌ CORS blocked
```

### Jetzt - Lokal
```
Browser → OpenAI API ✅ Direkt (mit API-Key)
```

### Jetzt - Netlify
```
Browser → Netlify Function → OpenAI API ✅ Proxy (sicher)
```

---

## 🧪 Testing

### Test 1: Lokaler Dev-Server
```bash
npm start
# Browser-Konsole prüfen:
# "🔧 Development mode: Using direct OpenAI API access (no proxy)"
```

### Test 2: Production Build
```bash
npm run build
# Prüfen Sie dist/main.*.js:
# API-Key sollte NICHT im Code sichtbar sein
```

### Test 3: Netlify Deploy
```bash
git push
# Nach Deploy: App testen
# Browser-Konsole prüfen:
# "🚀 Production mode: Using Netlify Function proxy"
```

---

## ⚙️ Konfiguration

### Lokale Entwicklung beschleunigen

**Weniger parallele Worker:**
```typescript
// environment.ts
canvas: {
  maxWorkers: 5, // Weniger Worker = weniger API-Load
}
```

**Günstigeres Modell:**
```typescript
// environment.ts
openai: {
  model: 'gpt-3.5-turbo', // Günstiger als gpt-4o-mini
}
```

---

## 🐛 Troubleshooting

### Fehler: "CORS blocked"
**Ursache:** API-Key in `environment.ts` fehlt oder leer

**Lösung:**
```typescript
// environment.ts
apiKey: 'sk-proj-...' // Key eintragen!
```

### Fehler: "API key not configured"
**Ursache:** Production-Build verwendet, aber Netlify Environment Variable fehlt

**Lösung:**
1. Netlify Dashboard → Environment Variables
2. Add: `OPENAI_API_KEY = sk-proj-...`
3. Redeploy

### Warnung: "Using direct OpenAI API access"
**Nicht wirklich ein Fehler!** Das ist normal in Development-Mode.

**Wenn Sie Production-Mode lokal testen wollen:**
```typescript
// environment.ts
production: true, // Simuliert Production
apiKey: '', // Leer → Nutzt Netlify Function
```

Dann müssen Sie aber `netlify dev` verwenden!

---

## 🎯 Best Practices

### ✅ DO
- ✅ API-Key in `environment.ts` für lokale Entwicklung
- ✅ API-Key in `environment.prod.ts` leer lassen
- ✅ Netlify Environment Variables für Production
- ✅ `.gitignore` prüfen (environment.ts ausgeschlossen)

### ❌ DON'T
- ❌ Niemals API-Key in `environment.prod.ts` committen
- ❌ Niemals `environment.ts` in Git pushen
- ❌ Niemals Production-Build mit API-Key im Code deployen

---

## 📚 Weitere Infos

- **CORS_FIX.md** - Wie die Netlify Function funktioniert
- **ENVIRONMENT_CONFIG.md** - Alle Konfigurationsoptionen
- **SECURITY_CHECKLIST.md** - Sicherheits-Checkliste

---

**Jetzt können Sie lokal entwickeln ohne Netlify CLI! 🎉**
