# 🚀 Netlify Deployment Guide

Dieser Guide zeigt, wie Sie die Angular App mit **sicherer API-Key-Verwaltung** auf Netlify deployen.

---

## ✅ Voraussetzungen

- Git Repository (GitHub, GitLab, Bitbucket, oder Azure DevOps)
- Netlify Account ([signup.netlify.com](https://signup.netlify.com))
- API-Keys (B_API_KEY oder OPENAI_API_KEY)

---

## 🔧 Schritt 1: Repository vorbereiten

### 1.1 Sicherstellen, dass `.env` in `.gitignore` steht

```bash
# .gitignore prüfen
cat .gitignore | grep ".env"

# Falls nicht vorhanden, hinzufügen:
echo ".env" >> .gitignore
```

### 1.2 Commit & Push

```bash
git add .
git commit -m "Security: Remove API keys from frontend, use Netlify Functions"
git push origin main
```

**⚠️ Wichtig:** Stellen Sie sicher, dass **keine `.env` Datei** ins Repository committed wurde!

---

## 🌐 Schritt 2: Site auf Netlify erstellen

### Option A: Netlify Dashboard (UI)

1. **Netlify Dashboard öffnen:** [app.netlify.com](https://app.netlify.com)
2. **"Add new site" → "Import an existing project"** klicken
3. **Git Provider** auswählen (GitHub, GitLab, etc.)
4. **Repository** auswählen
5. **Build Settings** prüfen:
   ```
   Build command: npm run build:prod
   Publish directory: dist
   ```
6. **"Deploy site"** klicken

### Option B: Netlify CLI

```bash
# CLI installieren (falls noch nicht vorhanden)
npm install -g netlify-cli

# In Projekt-Verzeichnis wechseln
cd webkomponente-canvas/

# Site erstellen und deployen
netlify init

# Folgen Sie den Prompts:
# - Team auswählen
# - Site-Name eingeben (oder automatisch generieren lassen)
# - Build command: npm run build:prod
# - Publish directory: dist
```

---

## 🔐 Schritt 3: Environment Variables als Secrets setzen

**Kritisch für Sicherheit:** API-Keys werden **NICHT** im Code gespeichert, sondern als Netlify **Secrets** (write-only, automatisches Secret Scanning)!

### Im Netlify Dashboard:

1. **Site Settings → Environment Variables** öffnen
2. **"Add a variable"** klicken
3. **Keys hinzufügen:**

#### Für B-API Provider (Standard):

```
Key: B_API_KEY
Value: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Scopes: Builds, Functions
☑️ Contains secret values (WICHTIG - aktiviert Secret Scanning!)
Deploy contexts: Production, Deploy Previews, Branch deploys
```

**⚠️ Nach Speichern:** Wert ist **write-only** (nie wieder lesbar)!

#### Optional: LLM Provider festlegen:

```
Key: LLM_PROVIDER
Value: b-api-openai
Options: openai, b-api-openai, b-api-academiccloud
```

#### Falls Sie OpenAI direkt nutzen:

```
Key: OPENAI_API_KEY
Value: sk-proj-your-key-here
Scopes: Builds, Functions
☑️ Contains secret values (WICHTIG!)
```

4. **"Save"** klicken

### Mit Netlify CLI:

```bash
# API Keys als Secrets setzen (--secret Flag!)
netlify env:set B_API_KEY "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" --secret
netlify env:set OPENAI_API_KEY "sk-proj-..." --secret

# Provider (KEIN Secret)
netlify env:set LLM_PROVIDER "b-api-openai"

# Variables anzeigen (Secrets sind maskiert: •••••••)
netlify env:list
```

### 🔍 Secret Scanning (automatisch aktiv)

Netlify scannt automatisch **alle Builds**, wenn Secrets gesetzt sind:
- ✅ Prüft Repository-Code
- ✅ Prüft Build-Output
- ✅ Sucht nach Secret-Werten (plaintext, base64, URI-encoded)
- ❌ **Build schlägt fehl**, falls Secret gefunden wird
- 📋 Deploy-Log zeigt Fundstelle

**Smart Detection** erkennt zusätzlich potenzielle Secrets automatisch!

---

## 🎯 Schritt 4: Deploy verifizieren

### 4.1 Build Logs prüfen

1. **Site Dashboard → Deploys** öffnen
2. **Letzten Deploy anklicken**
3. **"Deploy log"** prüfen auf:
   - ✅ `npm run build:prod` erfolgreich
   - ✅ Netlify Functions deployed (`openai-proxy`, `photon`, `repository-proxy`)
   - ✅ Keine Fehler

### 4.2 Site öffnen

```bash
# Mit CLI:
netlify open:site

# Oder im Dashboard auf "Open production deploy" klicken
```

### 4.3 Browser DevTools: Bundle auf API-Keys prüfen

**Kritischer Sicherheitstest:**

1. **Site im Browser öffnen**
2. **DevTools → Sources Tab**
3. **`main.js` öffnen** (großes Bundle-File)
4. **Suchen nach:**
   - `sk-proj` → **Sollte NICHT gefunden werden!**
   - `xxxxxxxx` → **Sollte NICHT gefunden werden!**

✅ Wenn keine Keys gefunden werden → **Sicher!**  
❌ Wenn Keys gefunden werden → **Problem! Siehe Troubleshooting**

---

## 🔄 Schritt 5: Continuous Deployment

Netlify baut und deployed automatisch bei jedem `git push`:

```bash
# Änderungen machen
git add .
git commit -m "Update feature"
git push origin main

# Netlify startet automatisch neuen Build
```

### Deploy-Benachrichtigungen

- **Email:** Automatisch bei jedem Deploy
- **Slack/Discord:** Integrationen verfügbar in Site Settings

---

## 🌍 Schritt 6: Custom Domain (Optional)

### Im Netlify Dashboard:

1. **Site Settings → Domain management**
2. **"Add custom domain"** klicken
3. **Domain eingeben** (z.B. `metadata.example.com`)
4. **DNS-Einträge** nach Anleitung setzen
5. **SSL** wird automatisch aktiviert (Let's Encrypt)

---

## 📊 Monitoring & Logs

### Function Logs anzeigen

```bash
# Live Logs (CLI)
netlify functions:log openai-proxy

# Im Dashboard:
# Functions → openai-proxy → Recent logs
```

### Analytics

1. **Site Dashboard → Analytics**
2. **Performance:** Core Web Vitals, Load Times
3. **Traffic:** Pageviews, Unique Visitors
4. **Functions:** Invocations, Errors

---

## 🛠️ Troubleshooting

### Problem 1: Build Failed

**Symptom:** Deploy schlägt fehl mit Build-Fehler

**Lösung:**
```bash
# Lokal testen
npm run build:prod

# Falls erfolgreich → Netlify Build Settings prüfen
# Falls fehlgeschlägt → Fehler fixen
```

### Problem 2: "API key not configured" in Production

**Symptom:** LLM-Requests schlagen fehl mit 500-Fehler

**Lösung:**
1. Netlify Dashboard → Environment Variables prüfen
2. `B_API_KEY` oder `OPENAI_API_KEY` muss gesetzt sein
3. Nach Änderung: **Redeploy** triggern
   ```bash
   netlify deploy --prod
   ```

### Problem 3: API-Keys im Bundle sichtbar

**Symptom:** DevTools zeigt `sk-proj` oder `bb6cdf` in `main.js`

**Lösung:**
1. `environment.ts` prüfen: `apiKey` Felder müssen leer sein (`''`)
2. `replace-env.js` prüfen: Key-Injection muss disabled sein
3. Neu committen & pushen
4. Bundle erneut prüfen

**Netlify Secret Scanning sollte dies verhindern!** Falls Secret im Bundle landet, schlägt Build automatisch fehl.

### Problem 4: Build schlägt fehl - "Secret detected in build output"

**Symptom:** Netlify Build bricht ab mit Fehlermeldung über gefundenes Secret

**Ursache:** Secret Scanning hat einen Wert gefunden, der einem Secret entspricht.

**Lösung:**

#### A) Echtes Secret gefunden (Leak!)
1. **Deploy-Log öffnen** → Zeigt genaue Fundstelle
2. **Secret aus Code entfernen** (z.B. aus `console.log`, Kommentaren, Bundles)
3. **API-Key rotieren** (neuen Key generieren, alten widerrufen)
4. **Neu deployen**

#### B) False Positive (kein echtes Secret)
1. **Safelist** für False Positive erstellen:
   ```bash
   netlify env:set SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES "false-positive-value-123,another-value"
   ```
2. **Oder Smart Detection deaktivieren** (nicht empfohlen):
   ```bash
   netlify env:set SECRETS_SCAN_SMART_DETECTION_ENABLED "false"
   ```
3. **Redeploy**

**Tipp:** Smart Detection erkennt auch Secrets, die NICHT als Environment Variables markiert sind!

### Problem 5: Functions nicht deployed

**Symptom:** Requests an `/.netlify/functions/openai-proxy` geben 404

**Lösung:**
1. `netlify.toml` prüfen:
   ```toml
   [functions]
     directory = "netlify/functions"
   ```
2. Functions-Dateien müssen existieren:
   ```
   netlify/functions/
   ├── openai-proxy.js
   ├── photon.js
   └── repository-proxy.js
   ```
3. Redeploy

---

## 📋 Checkliste vor Go-Live

### Sicherheit
- [ ] `.env` ist in `.gitignore` (nicht im Repo)
- [ ] `environment.ts` hat `apiKey: ''` (leer)
- [ ] `environment.prod.ts` hat `apiKey: ''` (leer)
- [ ] Netlify Environment Variables als **Secrets** gesetzt (☑️ "Contains secret values")
- [ ] Secret Scanning aktiviert (automatisch bei Secrets)
- [ ] Smart Detection aktiviert (automatisch auf Pro/Enterprise)
- [ ] Bundle auf Keys durchsucht → keine gefunden ✅

### Funktionalität
- [ ] Deploy erfolgreich (keine Build-Fehler, keine Secret-Leaks)
- [ ] LLM-Funktionalität in Production getestet
- [ ] Geocoding funktioniert (Photon via Netlify Function)
- [ ] Repository-Integration funktioniert

### Infrastructure
- [ ] Custom Domain konfiguriert (falls gewünscht)
- [ ] SSL aktiviert (automatisch via Let's Encrypt)
- [ ] Netlify Functions deployed (openai-proxy, photon, repository-proxy)
- [ ] Monitoring/Alerts eingerichtet
- [ ] Deploy Previews aktiviert (für Pull Requests)

---

## 🔗 Nützliche Links

- **Netlify Dashboard:** [app.netlify.com](https://app.netlify.com)
- **Netlify Docs:** [docs.netlify.com](https://docs.netlify.com)
- **Angular on Netlify:** [docs.netlify.com/frameworks/angular](https://docs.netlify.com/frameworks/angular/)
- **Netlify Functions:** [docs.netlify.com/functions/overview](https://docs.netlify.com/functions/overview/)
- **Environment Variables:** [docs.netlify.com/environment-variables](https://docs.netlify.com/environment-variables/)
- **🔐 Secrets Controller:** [docs.netlify.com/security/secrets-controller](https://docs.netlify.com/security/secrets-controller/) (Write-only secrets + Secret scanning)

---

## 💡 Best Practices

1. **Separate Environments:** Nutzen Sie Branch Deploys für Staging/Development
2. **Deploy Previews:** Aktivieren Sie Deploy Previews für Pull Requests
3. **Rollbacks:** Nutzen Sie Netlify's One-Click-Rollback bei Problemen
4. **Caching:** Netlify CDN cached automatisch Static Assets
5. **Analytics:** Monitoren Sie Performance mit Netlify Analytics

---

## 🎓 Weiterführende Themen

- **Branch Deploys:** Automatisches Staging für Feature-Branches
- **Split Testing:** A/B Testing mit Netlify
- **Edge Functions:** Server-Side Logic näher am User
- **Build Plugins:** Custom Build-Schritte automatisieren

Happy Deploying! 🚀
