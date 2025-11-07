# 🔒 Deployment Security Guide - WLO Guest Credentials

## ⚠️ Security Alert

**CRITICAL:** WLO Guest Credentials sind jetzt in Umgebungsvariablen ausgelagert und **NIEMALS** mehr im Code hardcodiert!

### Was wurde geändert?

**Vorher (UNSICHER):**
```javascript
// ❌ Hardcodiert im Code - NICHT SICHER!
const GUEST_CONFIG = {
  username: '<your-wlo-username>',
  password: '<your-wlo-password>',
  baseUrl: 'https://repository.staging.openeduhub.net/edu-sharing'
};
```

**Jetzt (SICHER):**
```javascript
// ✅ Aus Umgebungsvariablen - SICHER!
const GUEST_CONFIG = {
  username: process.env.WLO_GUEST_USERNAME,
  password: process.env.WLO_GUEST_PASSWORD,
  baseUrl: process.env.WLO_REPOSITORY_BASE_URL
};
```

---

## 🚀 Deployment Konfiguration

### 1. Lokale Entwicklung

**Setup:**
```bash
# 1. Template kopieren
cp .env.template .env

# 2. .env bearbeiten und Werte eintragen
# 3. Server starten
npm start
```

**Wichtig:**
- `.env` ist in `.gitignore` - wird NIEMALS committed!
- Bei Team-Mitgliedern: `.env.template` teilen, nicht `.env`!

---

### 2. Vercel Deployment

#### 🎯 Setup in Vercel Dashboard

**Schritt 1: Environment Variables hinzufügen**
1. Öffne dein Projekt in Vercel Dashboard
2. Gehe zu: `Settings` → `Environment Variables`
3. Füge folgende Variables hinzu:

| Variable | Wert | Umgebungen |
|----------|------|------------|
| `WLO_GUEST_USERNAME` | `<your-wlo-username>` | Production, Preview, Development |
| `WLO_GUEST_PASSWORD` | `<your-wlo-password>` | Production, Preview, Development |
| `WLO_REPOSITORY_BASE_URL` | `https://repository.staging.openeduhub.net/edu-sharing` | Production, Preview, Development |
| `LLM_PROVIDER` | `b-api-openai` | Production, Preview, Development |
| `B_API_KEY` | `your-b-api-key` | Production, Preview, Development |

**Schritt 2: Sensitive Variables markieren**
- Klicke das 🔒 Icon neben Password/API Keys
- Vercel verschlüsselt diese automatisch
- Sie sind danach nur noch als `***` sichtbar

**Schritt 3: Re-Deploy**
```bash
# Push triggert Auto-Deploy
git push origin main

# Oder manuell in Vercel:
vercel --prod
```

#### 🔧 Vercel CLI Alternative

```bash
# Login
vercel login

# Environment Variables setzen
vercel env add WLO_GUEST_USERNAME production
vercel env add WLO_GUEST_PASSWORD production
vercel env add WLO_REPOSITORY_BASE_URL production

# Alle Umgebungen auf einmal
vercel env add WLO_GUEST_USERNAME
# Wähle: Production, Preview, Development

# Deploy
vercel --prod
```

#### ✅ Vercel Verifizierung

```bash
# Environment Variables anzeigen
vercel env ls

# Server Logs prüfen
vercel logs

# Bei Start sollte erscheinen:
# ✅ Environment variables loaded
# ✅ WLO Guest credentials configured
```

---

### 3. Netlify Deployment

#### 🎯 Setup in Netlify Dashboard

**Schritt 1: Environment Variables hinzufügen**
1. Öffne dein Site in Netlify Dashboard
2. Gehe zu: `Site settings` → `Build & deploy` → `Environment` → `Environment variables`
3. Klicke `Add a variable`

**Variablen hinzufügen:**

| Key | Value | Options |
|-----|-------|---------|
| `WLO_GUEST_USERNAME` | `<your-wlo-username>` | - |
| `WLO_GUEST_PASSWORD` | `<your-wlo-password>` | ✅ **Sensitive variable** |
| `WLO_REPOSITORY_BASE_URL` | `https://repository.staging.openeduhub.net/edu-sharing` | - |
| `LLM_PROVIDER` | `b-api-openai` | - |
| `B_API_KEY` | `your-b-api-key` | ✅ **Sensitive variable** |

**⚠️ WICHTIG für Sensitive Variables:**
- Checkbox `Sensitive variable` aktivieren
- Nach dem Speichern sind sie **write-only**
- Du kannst sie **niemals wieder lesen**
- Nur ändern oder löschen möglich

**Schritt 2: Re-Deploy**
```bash
# Option 1: Git Push (Auto-Deploy)
git push origin main

# Option 2: Manual Deploy im Dashboard
# Klicke: "Trigger deploy" → "Deploy site"

# Option 3: Netlify CLI
netlify deploy --prod
```

#### 🔧 Netlify CLI Alternative

```bash
# Login
netlify login

# Link to Site
netlify link

# Environment Variables setzen
netlify env:set WLO_GUEST_USERNAME "<your-wlo-username>"
netlify env:set WLO_GUEST_PASSWORD "<your-wlo-password>" --secret
netlify env:set WLO_REPOSITORY_BASE_URL "https://repository.staging.openeduhub.net/edu-sharing"
netlify env:set LLM_PROVIDER "b-api-openai"
netlify env:set B_API_KEY "your-key" --secret

# Variables anzeigen
netlify env:list

# Deploy
netlify deploy --prod
```

#### ✅ Netlify Verifizierung

```bash
# Environment Variables prüfen
netlify env:list

# Function Logs prüfen
netlify functions:log

# Live Site testen
netlify open:site
```

---

### 4. Docker Deployment

#### 🐳 Docker Compose

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  metadata-agent:
    image: metadata-agent-canvas:latest
    ports:
      - "3000:3000"
    environment:
      # LLM Configuration
      - LLM_PROVIDER=b-api-openai
      - B_API_KEY=${B_API_KEY}
      
      # WLO Guest Credentials
      - WLO_GUEST_USERNAME=${WLO_GUEST_USERNAME}
      - WLO_GUEST_PASSWORD=${WLO_GUEST_PASSWORD}
      - WLO_REPOSITORY_BASE_URL=https://repository.staging.openeduhub.net/edu-sharing
      
      # Rate Limits
      - RATE_LIMIT_LLM_MAX=150
      - RATE_LIMIT_API_MAX=1500
    env_file:
      - .env
```

**Start:**
```bash
docker-compose up -d
```

#### 🐳 Docker Run

```bash
docker run -d \
  -p 3000:3000 \
  -e WLO_GUEST_USERNAME="<your-wlo-username>" \
  -e WLO_GUEST_PASSWORD="<your-wlo-password>" \
  -e WLO_REPOSITORY_BASE_URL="https://repository.staging.openeduhub.net/edu-sharing" \
  -e LLM_PROVIDER="b-api-openai" \
  -e B_API_KEY="your-key" \
  metadata-agent-canvas:latest
```

---

## 🔐 Security Best Practices

### ✅ DO's

1. **Environment Variables verwenden**
   - Alle Credentials in `.env` oder Platform-Env-Vars
   - NIEMALS im Code hardcoden

2. **Sensitive Variables markieren**
   - Vercel: 🔒 Icon aktivieren
   - Netlify: "Sensitive variable" Checkbox
   - Diese werden verschlüsselt gespeichert

3. **Secrets Rotation**
   - Regelmäßig Passwords ändern
   - Bei Leak sofort rotieren

4. **Access Control**
   - Nur Team-Mitglieder mit Deploy-Rechten
   - Vercel/Netlify Role-Based Access verwenden

5. **Monitoring**
   - Server Logs regelmäßig prüfen
   - Failed Auth-Attempts überwachen

### ❌ DON'Ts

1. **NIEMALS in Git committen**
   ```bash
   # ❌ FALSCH
   git add .env
   
   # ✅ RICHTIG
   # .env ist bereits in .gitignore!
   ```

2. **NIEMALS im Code hardcoden**
   ```javascript
   // ❌ FALSCH
   const password = '<your-wlo-password>';
   
   // ✅ RICHTIG
   const password = process.env.WLO_GUEST_PASSWORD;
   ```

3. **NIEMALS in Logs ausgeben**
   ```javascript
   // ❌ FALSCH
   console.log('Password:', process.env.WLO_GUEST_PASSWORD);
   
   // ✅ RICHTIG
   console.log('✅ WLO credentials loaded');
   ```

4. **NIEMALS in Client-Code**
   - Backend-only Secrets!
   - Frontend hat keinen Zugriff auf process.env

5. **NIEMALS öffentlich teilen**
   - Nicht in Slack/Discord posten
   - Nicht in Screenshots zeigen
   - Nicht in Dokumentation committed

---

## 🧪 Verifizierung

### Lokale Prüfung

```bash
# Server starten
npm start

# Logs prüfen - sollte erscheinen:
# ✅ Environment variables loaded
# ✅ WLO Guest credentials configured
# 🚀 Server running on port 3000

# Fehler wenn Credentials fehlen:
# ❌ WLO_GUEST_USERNAME and WLO_GUEST_PASSWORD are required
```

### Production Prüfung

```bash
# Health Check
curl https://your-domain.vercel.app/api/health

# Repository Test (wenn deployed)
curl -X POST https://your-domain.vercel.app/repository \
  -H "Content-Type: application/json" \
  -d '{"action":"checkDuplicate","data":{"url":"https://example.com"}}'

# Response sollte KEIN Password enthalten!
```

---

## 🆘 Troubleshooting

### Problem: "WLO credentials required" Error

**Lösung:**
```bash
# 1. Environment Variables prüfen
echo $WLO_GUEST_USERNAME
echo $WLO_GUEST_PASSWORD

# 2. Falls leer: In .env setzen
# 3. Server neu starten
npm start
```

### Problem: Authentication Failed

**Lösung:**
1. Credentials in .env prüfen (Tippfehler?)
2. WLO Repository erreichbar?
   ```bash
   curl https://repository.staging.openeduhub.net/edu-sharing
   ```
3. Server Logs prüfen für Details

### Problem: Vercel Deploy funktioniert nicht

**Lösung:**
```bash
# 1. Env Vars prüfen
vercel env ls

# 2. Falls fehlt: Hinzufügen
vercel env add WLO_GUEST_USERNAME
vercel env add WLO_GUEST_PASSWORD

# 3. Re-Deploy
vercel --prod --force
```

### Problem: Netlify 401 Error

**Lösung:**
1. Site Settings → Environment → Variables prüfen
2. Sensitive Variables neu setzen (können nicht gelesen werden)
3. Clear cache & deploy:
   ```bash
   netlify deploy --prod --clear-cache
   ```

---

## 📋 Checkliste für Deployment

- [ ] `.env.template` kopiert zu `.env`
- [ ] Alle Werte in `.env` eingetragen
- [ ] `.env` in `.gitignore` (sollte bereits da sein)
- [ ] Lokaler Test erfolgreich
- [ ] Environment Variables in Vercel/Netlify gesetzt
- [ ] Sensitive Variables markiert
- [ ] Production Deploy erfolgreich
- [ ] Health Check erfolgreich
- [ ] Upload Test erfolgreich
- [ ] Team informiert über neue Env-Vars

---

## 🔄 Migration von altem Code

Wenn du von hardcodierten Credentials migrierst:

**1. Git History bereinigen (falls Credentials jemals committed wurden):**
```bash
# ⚠️ NUR wenn wirklich nötig - rewrites history!
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch server/index.js" \
  --prune-empty --tag-name-filter cat -- --all

# Force Push (koordiniere mit Team!)
git push origin --force --all
```

**2. Credentials rotieren:**
- Alte Passwords ändern
- Neue in Environment Variables setzen

**3. Code Review:**
```bash
# Alle Dateien nach Secrets durchsuchen
grep -r "wlo#upload" .
grep -r "<your-wlo-username>" .
```

---

## 📚 Weiterführende Links

- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Netlify Environment Variables Docs](https://docs.netlify.com/configure-builds/environment-variables/)
- [Docker Secrets Management](https://docs.docker.com/engine/swarm/secrets/)
- [12-Factor App Config](https://12factor.net/config)

---

**Letzte Aktualisierung:** 2025-01-07  
**Autor:** Metadata Agent Team  
**Status:** ✅ Production Ready
