# 🚀 Vercel Deployment mit Environment Variable

## Schnell-Anleitung

### Schritt 1: Vercel CLI installieren

```bash
npm install -g vercel
```

### Schritt 2: Login

```bash
vercel login
```

### Schritt 3: API-Key als Environment Variable setzen

**Option A: Via CLI (empfohlen)**
```bash
vercel env add OPENAI_API_KEY
```

Dann:
1. Wert eingeben: Ihren OpenAI API-Key (sk-proj-...)
2. Environment wählen: **Production** (Enter drücken)
3. Bestätigen

**Option B: Via Vercel Dashboard**
1. Gehen Sie zu https://vercel.com/dashboard
2. Wählen Sie Ihr Projekt (oder erstellen Sie es beim ersten Deploy)
3. Settings → Environment Variables
4. Add:
   - Name: `OPENAI_API_KEY`
   - Value: Ihr OpenAI API-Key
   - Environment: Production
5. Save

### Schritt 4: Deploy

```bash
vercel --prod
```

**Das war's!** 🎉

---

## 📊 Was passiert beim Build?

1. Vercel startet den Build-Prozess
2. `replace-env.js` wird ausgeführt:
   - Liest `OPENAI_API_KEY` aus Vercel Environment Variables
   - Ersetzt `apiKey: ''` in `environment.prod.ts`
   - Schreibt den Key in die Datei
3. Angular Build startet mit dem injizierten Key
4. App wird deployed mit API-Key

---

## ✅ Verifizierung

Nach dem Deployment:

1. **Öffnen Sie die deployed URL:**
   ```
   https://your-project.vercel.app/
   ```

2. **Prüfen Sie die Logs:**
   ```bash
   vercel logs
   ```
   
   Sie sollten sehen:
   ```
   ✅ Injecting OPENAI_API_KEY into environment.prod.ts
   ✅ Environment variables processed
   ```

3. **Testen Sie die App:**
   - Öffnen Sie die Test-Sidebar
   - Kopieren Sie den Muster-Text
   - Klicken Sie "Extraktion starten"
   - Die App sollte **NICHT** nach dem API-Key fragen
   - Extraktion sollte sofort starten ✅

---

## 🔄 Updates deployen

Wenn Sie Code-Änderungen machen:

```bash
# Code ändern
git add .
git commit -m "Update: ..."

# Deploy
vercel --prod
```

Der API-Key wird automatisch wieder injiziert!

---

## 🔧 Troubleshooting

### Problem: "API-Key nicht gefunden"

**Lösung 1: Prüfen Sie die Environment Variable**
```bash
vercel env ls
```

Sie sollten `OPENAI_API_KEY` in der Liste sehen.

**Lösung 2: Neu setzen**
```bash
vercel env rm OPENAI_API_KEY
vercel env add OPENAI_API_KEY
```

**Lösung 3: Build-Logs prüfen**
```bash
vercel logs
```

Suchen Sie nach:
```
✅ Injecting OPENAI_API_KEY into environment.prod.ts
```

Wenn das **nicht** erscheint, wurde der Key nicht gefunden!

### Problem: "Build failed"

**Häufigste Ursachen:**
1. Node-Version nicht kompatibel (sollte >=18 sein)
2. Dependencies fehlen
3. TypeScript-Fehler

**Lösung:**
```bash
# Lokal testen
npm run build

# Wenn Fehler → Beheben
# Dann neu deployen
vercel --prod
```

---

## ⚠️ Sicherheits-Hinweise

### API-Key Sicherheit

**⚠️ WICHTIG:**
- Der API-Key wird in den **Bundle** gebacken
- Er ist im Browser-Code **sichtbar** (DevTools → Sources)
- Für **öffentliche Apps** ist das NICHT sicher!
- Für **interne/Demo-Apps** ist es OK

**Empfehlung:**
- Rate Limits in OpenAI Dashboard setzen
- Budget-Limits konfigurieren
- Usage Monitoring aktivieren

### Bessere Alternative für Production:

Wenn die App öffentlich ist, sollten Sie:
1. Backend-Service erstellen (z.B. Vercel Serverless Function)
2. API-Key nur im Backend speichern
3. Frontend → Backend → OpenAI

---

## 💰 Kosten-Kontrolle

### OpenAI Dashboard:
1. Gehen Sie zu https://platform.openai.com/usage
2. Setzen Sie:
   - **Hard Limit:** z.B. $50/Monat
   - **Email Alerts:** bei 50%, 75%, 90%

### Vercel:
- **Bandwidth:** 100 GB/Monat (Hobby Plan)
- **Build Minutes:** 6000 Min/Monat
- Für Test-Deployment mehr als genug!

---

## 📚 Weitere Ressourcen

- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [OpenAI API Keys](https://platform.openai.com/api-keys)
- [Angular Production Build](https://angular.io/guide/deployment)

---

**Viel Erfolg! 🚀**
