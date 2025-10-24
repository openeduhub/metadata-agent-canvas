# 🔐 Netlify Secrets Controller - Sichere API-Key-Verwaltung

Dieses Dokument erklärt die sichere Verwaltung von API-Keys mit **Netlify Secrets Controller** für `webkomponente-canvas`.

---

## 📋 Übersicht

**Netlify Secrets Controller** bietet erweiterte Sicherheit für Environment Variables mit sensiblen Daten wie API-Keys:

### ✅ Vorteile von Secrets Controller

| Feature | Beschreibung |
|---------|-------------|
| **Write-only** | Nach dem Speichern nie wieder lesbar (auch nicht im Dashboard) |
| **Secret Scanning** | Automatische Prüfung auf Leaks in Code & Bundles |
| **Smart Detection** | Erkennt auch nicht-markierte Secrets automatisch |
| **Build fails on leak** | Verhindert Deployment bei gefundenen Secrets |
| **Multi-Format-Scan** | Sucht plaintext, base64, URI-encoded Versionen |
| **No post-processing** | Verhindert Snippet-Injection mit Secrets |

### ❌ Ohne Secrets Controller

- Environment Variables sind lesbar im Dashboard
- Kein automatisches Secret Scanning
- Höheres Risiko für versehentliche Leaks

---

## 🏗️ Architektur: Secrets bleiben Server-Side

```
┌─────────────────────────────────────────────────────────┐
│  Angular Frontend (Client-Side)                         │
│  • Keine API-Keys im Code                              │
│  • Keine API-Keys im Bundle (main.js)                  │
│  • apiKey: '' in environment.ts/environment.prod.ts    │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ HTTP Request (ohne API-Key)
                 ├─────────────────────────────────────┐
                 │                                     │
           Development                            Production
                 │                                     │
    ┌────────────▼──────────┐           ┌─────────────▼──────────┐
    │  Universal Proxy      │           │  Netlify Functions     │
    │  (localhost:3001)     │           │  /.netlify/functions/* │
    │                       │           │                        │
    │  Liest aus .env:      │           │  Liest aus Netlify:    │
    │  • OPENAI_API_KEY     │           │  • OPENAI_API_KEY      │
    │  • B_API_KEY          │           │  • B_API_KEY           │
    │  • LLM_PROVIDER       │           │  • LLM_PROVIDER        │
    └────────────┬──────────┘           └─────────────┬──────────┘
                 │                                     │
                 │ Fügt API-Key hinzu                  │
                 │ (Authorization/X-API-KEY Header)    │
                 └─────────────────┬───────────────────┘
                                   │
                      ┌────────────▼────────────┐
                      │  Externe APIs           │
                      │  • OpenAI API           │
                      │  • B-API OpenAI         │
                      │  • B-API AcademicCloud  │
                      │  • Photon Geocoding     │
                      │  • Repository API       │
                      └─────────────────────────┘
```

**Wichtig:** 
- ✅ Frontend sendet Requests **ohne API-Keys**
- ✅ Proxy/Functions fügen Keys server-side hinzu
- ✅ Keys sind niemals im Browser sichtbar

---

## 🚀 Setup: Schritt-für-Schritt

### 1️⃣ Lokale Entwicklung

#### `.env` Datei erstellen

Erstellen Sie eine `.env` Datei im Projekt-Root (`webkomponente-canvas/.env`):

```bash
# ===========================
# LLM Provider Configuration
# ===========================

# LLM Provider Selection (Optional)
# Options: openai, b-api-openai, b-api-academiccloud
# Default: b-api-openai
LLM_PROVIDER=b-api-openai

# OpenAI API Key (Required if LLM_PROVIDER=openai)
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-your-actual-key-here

# B-API Key (Required if LLM_PROVIDER=b-api-openai or b-api-academiccloud)
B_API_KEY=your-uuid-key-here

# OpenAI Model (Optional)
# Default: gpt-4.1-mini
OPENAI_MODEL=gpt-4.1-mini

# GPT-5 Performance Settings (Optional - only for gpt-5 models)
GPT5_REASONING_EFFORT=minimal
GPT5_VERBOSITY=low
```

**⚠️ WICHTIG:**
- `.env` ist bereits in `.gitignore` → wird **NICHT** ins Repository committed!
- Kopieren Sie `.env.example` zu `.env` und fügen Sie Ihre echten Keys ein

#### Development starten

```bash
# Terminal 1: Universal Proxy starten
npm run proxy

# Terminal 2: Angular Development Server
npm start
```

Der Proxy liest die Keys aus `.env` und leitet Requests an die APIs weiter.

---

### 2️⃣ Netlify Production Setup

#### A) Environment Variables im Netlify Dashboard setzen

**Navigieren Sie zu:**
```
Site Dashboard → Site configuration → Environment variables
```

**Fügen Sie folgende Variables hinzu:**

| Key | Value | Deploy Contexts | Secret? |
|-----|-------|----------------|---------|
| `OPENAI_API_KEY` | `sk-proj-your-key` | Production, Deploy Previews, Branch deploys | ✅ **Ja** |
| `B_API_KEY` | `xxxxxxxx-xxxx-...` | Production, Deploy Previews, Branch deploys | ✅ **Ja** |
| `LLM_PROVIDER` | `b-api-openai` | Production, Deploy Previews, Branch deploys | ❌ Nein |

**Für API-Keys: "Contains secret values" aktivieren:**

1. Klicken Sie auf "Add a variable" → "Add a single variable"
2. **Key name:** `OPENAI_API_KEY` (oder `B_API_KEY`)
3. **Value:** Ihr echter API-Key
4. **✅ Aktivieren Sie "Contains secret values"** (Checkbox)
5. **Scopes:** Wählen Sie alle relevanten Deploy Contexts:
   - ✅ Production
   - ✅ Deploy Previews
   - ✅ Branch deploys
6. **Klicken Sie auf "Create variable"**

**⚠️ WICHTIG nach dem Speichern:**
- Der Key ist jetzt **write-only** → nie wieder lesbar (auch nicht im Dashboard)
- Secret Scanning ist automatisch aktiviert
- Beim nächsten Build wird automatisch auf Leaks geprüft

#### B) Environment Variables via Netlify CLI setzen

```bash
# Mit --secret Flag für API-Keys
netlify env:set OPENAI_API_KEY "sk-proj-your-actual-key" --secret
netlify env:set B_API_KEY "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" --secret

# Ohne --secret für nicht-sensitive Werte
netlify env:set LLM_PROVIDER "b-api-openai"
```

**Hinweis:** Das `--secret` Flag markiert die Variable automatisch als "Contains secret values".

#### C) Für `dev` Deploy Context (Optional)

Netlify erlaubt, **unmasked Values** im `dev` Context zu speichern (für lokale `netlify dev`):

```bash
# Im Dashboard:
# Deploy context: "dev" auswählen
# Value: Ihr Test-Key (z.B. dummy key für lokale Tests)
# "Contains secret values": NICHT aktivieren

# Via CLI:
netlify env:set OPENAI_API_KEY "sk-test-dummy-key" --context dev
```

**Vorteil:** 
- Im `dev` Context bleibt der Wert lesbar (für `netlify dev`)
- In Production bleibt er masked/write-only

---

### 3️⃣ Secret Scanning Konfiguration

Secret Scanning ist **automatisch aktiviert**, sobald Sie Environment Variables als "secret" markieren.

#### Standard-Verhalten

Netlify scannt automatisch nach:
- **Plaintext** Secrets
- **Base64-encoded** Secrets
- **URI-encoded** Secrets
- **Multi-line** Secrets (als single-line und multi-line)

**Mindestlänge:** 4 Zeichen (kürzere Werte werden ignoriert)

#### Konfiguration anpassen (Optional)

Sie können das Scanning anpassen mit Environment Variables:

| Variable | Beschreibung | Beispiel |
|----------|-------------|----------|
| `SECRETS_SCAN_ENABLED` | Secret Scanning aktivieren/deaktivieren | `true` (default) |
| `SECRETS_SCAN_OMIT_KEYS` | Keys von Scanning ausschließen | `TEST_KEY,DEMO_KEY` |
| `SECRETS_SCAN_OMIT_PATHS` | Dateipfade von Scanning ausschließen | `node_modules/**,dist/**` |

**Beispiel: Bestimmte Pfade ausschließen**

```bash
# Im Netlify Dashboard
Key: SECRETS_SCAN_OMIT_PATHS
Value: node_modules/**,dist/assets/test-data.json
Scopes: All
```

**Hinweis:** In der Regel sind diese Anpassungen **nicht nötig**, da Netlify intelligent genug ist, relevante Dateien zu scannen.

#### Smart Detection

**Smart Detection** erkennt **automatisch** potenzielle Secrets, auch wenn sie **nicht** als "secret" markiert sind:

- Erkennt gängige Secret-Muster (API-Keys, Tokens, Passwörter)
- **Schlägt Build fehl**, wenn potenzielle Secrets gefunden werden
- Automatisch aktiviert auf Pro/Enterprise Plans

**False Positives beheben:**

Wenn Smart Detection einen String fälschlicherweise als Secret erkennt:

```bash
# Im Netlify Dashboard
Key: SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES
Value: not-a-secret-string,another-false-positive
Scopes: All
```

**Smart Detection deaktivieren (nicht empfohlen):**

```bash
Key: SECRETS_SCAN_SMART_DETECTION_ENABLED
Value: false
Scopes: All
```

⚠️ **Warnung:** Besser False Positives zur Safelist hinzufügen, anstatt Smart Detection zu deaktivieren!

---

## 🧪 Sicherheitschecks

### ✅ Lokal testen

```bash
# 1. .env existiert und ist in .gitignore
cat .env
git status .env  # Sollte NICHT gelistet sein

# 2. environment.ts und environment.prod.ts haben keine Keys
grep -r "sk-proj" src/environments/
grep -r "bb6cdf" src/environments/
# Sollte KEINE Treffer haben!

# 3. Build erstellen und Bundle prüfen
npm run build:prod

# 4. Bundle auf Keys durchsuchen (PowerShell)
Select-String -Path "dist/main*.js" -Pattern "sk-proj|bb6cdf"
# Sollte NICHTS finden!

# Linux/Mac:
grep -r "sk-proj\|bb6cdf" dist/
# Sollte NICHTS finden!
```

### ✅ Production testen

**Nach Deployment zu Netlify:**

1. **Öffnen Sie die deployed Site** in Ihrem Browser
2. **Developer Tools** → Sources/Debugger
3. **Suchen Sie nach dem Bundle** (z.B. `main.abc123.js`)
4. **Durchsuchen Sie nach:**
   - `sk-proj` (OpenAI Keys)
   - `bb6cdf` (Ihr B-API Key Prefix)
   - UUID-Pattern: `[a-f0-9]{8}-[a-f0-9]{4}-...`
5. **Sollte NICHTS finden!**

**Deploy Log prüfen:**

Gehen Sie zu: `Site Dashboard → Deploys → [Your Deploy]`

**Erfolgreicher Build (ohne Leaks):**
```
✅ Secret scanning: No secrets found
✅ Build successful
```

**Build schlägt fehl (Secret gefunden):**
```
❌ Secret scanning: Detected secret values
   Location: dist/main.abc123.js:line 42
   Type: OPENAI_API_KEY
❌ Build failed to prevent secret exposure
```

---

## 🛠️ Troubleshooting

### Problem 1: "API key not configured" in Production

**Symptom:**
```json
{
  "error": "API key not configured",
  "message": "Please set OPENAI_API_KEY in Netlify Dashboard"
}
```

**Ursache:** Environment Variable nicht gesetzt oder falsche Deploy Context.

**Lösung:**
1. Gehen Sie zu: `Site Dashboard → Environment variables`
2. Prüfen Sie, ob `OPENAI_API_KEY` (oder `B_API_KEY`) existiert
3. Prüfen Sie die **Scopes**: Sollte "Production" enthalten
4. **Re-deploy** triggern: `Site Dashboard → Deploys → Trigger deploy`

### Problem 2: Build schlägt fehl mit "Secret detected"

**Symptom:**
```
❌ Secret scanning: Detected secret values
   Location: dist/main.abc123.js
```

**Ursache:** API-Key wurde in Code/Bundle injiziert.

**Lösung:**
1. **Prüfen Sie `environment.prod.ts`:**
   ```typescript
   apiKey: '', // Muss leer sein!
   ```
2. **Prüfen Sie `replace-env.js`:**
   - Stellen Sie sicher, dass Key-Injection **deaktiviert** ist
3. **Lokalen Build testen:**
   ```bash
   npm run build:prod
   grep -r "sk-proj" dist/  # Sollte NICHTS finden
   ```
4. **Re-deploy** nach Fixes

### Problem 3: Secret Scanning findet False Positives

**Symptom:**
```
❌ Smart detection: Detected potential secret
   Location: src/app/test-data.ts:line 15
   Value: "not-a-real-secret-just-test-data"
```

**Ursache:** Smart Detection erkennt harmlosen String als Secret.

**Lösung:**
```bash
# Im Netlify Dashboard
Key: SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES
Value: not-a-real-secret-just-test-data
Scopes: All
```

### Problem 4: Kann Environment Variable nicht mehr sehen

**Symptom:** Nach Aktivierung von "Contains secret values" ist der Key nicht mehr lesbar.

**Ursache:** Das ist gewollt! Secrets sind **write-only**.

**Lösung:**
- **Kein Zugriff mehr möglich** (auch nicht für Admins)
- Wenn Sie den Key brauchen: Erstellen Sie einen **neuen** Key bei Ihrem Provider
- **Überschreiben Sie die Variable** mit dem neuen Key:
  ```bash
  netlify env:set OPENAI_API_KEY "sk-proj-NEW-KEY" --secret
  ```

### Problem 5: Lokaler Proxy kann API nicht erreichen

**Symptom:**
```
Failed to fetch http://localhost:3001/llm
```

**Ursache:** Universal Proxy läuft nicht.

**Lösung:**
```bash
# Terminal 1
npm run proxy

# Terminal 2 (neues Terminal)
npm start
```

---

## 📚 Best Practices

### ✅ DO's

- ✅ **Immer** API-Keys als "secret" markieren
- ✅ `.env` lokal verwenden (nicht in Git committen)
- ✅ `environment.ts` und `environment.prod.ts` mit `apiKey: ''` (leer)
- ✅ Keys nur in Netlify Functions/Proxies verwenden
- ✅ Secret Scanning aktiviert lassen
- ✅ Nach Deployment Bundle auf Leaks prüfen
- ✅ Keys regelmäßig rotieren (neue Keys generieren)

### ❌ DON'Ts

- ❌ **NIEMALS** Keys in Code committen
- ❌ **NIEMALS** Keys in Frontend (environment.ts/prod.ts) hardcoden
- ❌ **NIEMALS** Secret Scanning deaktivieren
- ❌ Keys in Client-Side Code verwenden
- ❌ Keys in URL-Parametern übergeben
- ❌ Keys in Console Logs ausgeben
- ❌ Alte Keys nach Rotation im Code lassen

---

## 🔄 Key Rotation (Keys regelmäßig erneuern)

**Empfohlen:** Alle 90 Tage (oder bei Verdacht auf Leak)

### Schritt-für-Schritt

1. **Neuen API-Key generieren** bei Ihrem Provider (OpenAI/B-API)
2. **Netlify Environment Variable überschreiben:**
   ```bash
   netlify env:set OPENAI_API_KEY "sk-proj-NEW-KEY" --secret
   ```
3. **Redeploy triggern**
4. **Alten Key invalidieren** bei Ihrem Provider
5. **Lokale `.env` aktualisieren:**
   ```bash
   # .env
   OPENAI_API_KEY=sk-proj-NEW-KEY
   ```

---

## 📊 Deployment Checklist

Vor jedem Production Deployment:

- [ ] `.env` existiert lokal (nicht committet)
- [ ] `.env` ist in `.gitignore`
- [ ] `environment.ts` hat `apiKey: ''` (leer)
- [ ] `environment.prod.ts` hat `apiKey: ''` (leer)
- [ ] Netlify Environment Variables gesetzt:
  - [ ] `OPENAI_API_KEY` oder `B_API_KEY`
  - [ ] Als "secret" markiert (✅ "Contains secret values")
  - [ ] Scopes: Production, Deploy Previews, Branch deploys
- [ ] `netlify.toml` definiert Functions-Ordner
- [ ] Lokaler Build getestet: `npm run build:prod`
- [ ] Bundle auf Keys durchsucht: `grep -r "sk-proj" dist/` → NICHTS gefunden
- [ ] Nach Deployment: Production Bundle geprüft → KEINE Keys sichtbar
- [ ] Deploy Log: "Secret scanning: No secrets found" ✅

---

## 🔗 Weitere Ressourcen

- **Netlify Secrets Controller:** https://docs.netlify.com/environment-variables/secret-controller/
- **Netlify Environment Variables:** https://docs.netlify.com/environment-variables/overview/
- **Netlify Functions:** https://docs.netlify.com/functions/overview/
- **OpenAI API Keys:** https://platform.openai.com/api-keys
- **OWASP Hardcoded Credentials:** https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password

---

## 📝 Zusammenfassung

```
┌─────────────────────────────────────────────────────────┐
│  Lokale Entwicklung                                     │
│  • .env Datei (in .gitignore)                           │
│  • Universal Proxy liest aus .env                       │
│  • Frontend hat apiKey: '' (leer)                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Netlify Production                                     │
│  • Environment Variables im Dashboard                   │
│  • Als "secret" markiert (write-only)                   │
│  • Secret Scanning automatisch aktiviert                │
│  • Netlify Functions lesen aus process.env             │
│  • Frontend hat apiKey: '' (leer)                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Sicherheit                                             │
│  • API-Keys bleiben server-side (Proxy/Functions)      │
│  • Nie im Frontend/Bundle                              │
│  • Automatisches Secret Scanning                       │
│  • Build schlägt fehl bei Leaks                        │
└─────────────────────────────────────────────────────────┘
```

---

**Stand:** Januar 2025  
**Letzte Aktualisierung:** Nach Implementierung von Netlify Secrets Controller
