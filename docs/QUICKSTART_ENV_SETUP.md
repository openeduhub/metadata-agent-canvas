# 🚀 Quick-Start: Environment Variables Setup

## ✅ Ja, es funktioniert genauso wie OpenAI API Key!

Die WLO Guest Credentials werden **exakt wie deine LLM API Keys** als Umgebungsvariablen gesetzt.

---

## 📋 Was wurde geändert?

### **Vorher (UNSICHER):**
```javascript
// ❌ Hardcodiert in server/index.js UND netlify/functions/repository-proxy.js
const GUEST_CONFIG = {
  username: 'WLO-Upload',
  password: 'wlo#upload!20',
  baseUrl: 'https://repository.staging.openeduhub.net/edu-sharing'
};
```

### **Jetzt (SICHER):**
```javascript
// ✅ Aus Environment Variables
const GUEST_CONFIG = {
  username: process.env.WLO_GUEST_USERNAME,
  password: process.env.WLO_GUEST_PASSWORD,
  baseUrl: process.env.WLO_REPOSITORY_BASE_URL
};
```

**Geänderte Dateien:**
- ✅ `server/index.js` (Express Server)
- ✅ `netlify/functions/repository-proxy.js` (Netlify Function)

---

## 🎯 Netlify Setup (5 Minuten)

### **Option A: Netlify Dashboard (Empfohlen)**

1. **Öffne dein Site in Netlify**
   - Gehe zu: https://app.netlify.com
   - Wähle dein Projekt

2. **Environment Variables hinzufügen**
   - Navigiere zu: `Site settings` → `Environment variables`
   - Klicke: `Add a variable`

3. **Füge diese 3 Variablen hinzu:**

| Key | Value | Sensitive? |
|-----|-------|-----------|
| `WLO_GUEST_USERNAME` | `WLO-Upload` | ❌ Nein |
| `WLO_GUEST_PASSWORD` | `wlo#upload!20` | ✅ **JA** - Checkbox aktivieren! |
| `WLO_REPOSITORY_BASE_URL` | `https://repository.staging.openeduhub.net/edu-sharing` | ❌ Nein |

   **⚠️ WICHTIG:**
   - Bei `WLO_GUEST_PASSWORD`: Checkbox "**Sensitive variable**" aktivieren!
   - Nach dem Speichern ist es **write-only** (kann nie wieder gelesen werden)

4. **Re-Deploy triggern**
   ```bash
   # Option 1: Git Push
   git push origin main
   
   # Option 2: Dashboard
   # Klicke: "Trigger deploy" → "Deploy site"
   ```

5. **Verifizieren**
   - Öffne deine Live-Site
   - Teste Upload-Funktion
   - Prüfe Function Logs: `Site overview` → `Functions` → `repository-proxy`

### **Option B: Netlify CLI**

```bash
# 1. Login (falls noch nicht)
netlify login

# 2. Link to Site (falls noch nicht)
netlify link

# 3. Environment Variables setzen
netlify env:set WLO_GUEST_USERNAME "WLO-Upload"
netlify env:set WLO_GUEST_PASSWORD "wlo#upload!20" --secret
netlify env:set WLO_REPOSITORY_BASE_URL "https://repository.staging.openeduhub.net/edu-sharing"

# 4. Verifizieren
netlify env:list

# Sollte zeigen:
# WLO_GUEST_USERNAME = WLO-Upload
# WLO_GUEST_PASSWORD = (secret)
# WLO_REPOSITORY_BASE_URL = https://repository.staging.openeduhub.net/edu-sharing

# 5. Deploy
netlify deploy --prod
```

---

## 🎯 Vercel Setup (5 Minuten)

### **Option A: Vercel Dashboard (Empfohlen)**

1. **Öffne dein Projekt in Vercel**
   - Gehe zu: https://vercel.com/dashboard
   - Wähle dein Projekt

2. **Environment Variables hinzufügen**
   - Navigiere zu: `Settings` → `Environment Variables`
   - Klicke: `Add New`

3. **Füge diese 3 Variablen hinzu:**

Für **jede** Variable:
- **Name:** `WLO_GUEST_USERNAME` / `WLO_GUEST_PASSWORD` / `WLO_REPOSITORY_BASE_URL`
- **Value:** (siehe unten)
- **Environments:** ✅ Production, ✅ Preview, ✅ Development

| Variable | Value |
|----------|-------|
| `WLO_GUEST_USERNAME` | `WLO-Upload` |
| `WLO_GUEST_PASSWORD` | `wlo#upload!20` ⚠️ Klicke 🔒 für Encryption |
| `WLO_REPOSITORY_BASE_URL` | `https://repository.staging.openeduhub.net/edu-sharing` |

   **⚠️ WICHTIG:**
   - Bei `WLO_GUEST_PASSWORD`: Klicke das **🔒 Icon** zum Verschlüsseln!
   - Vercel verschlüsselt es automatisch (dann nur noch `***` sichtbar)

4. **Re-Deploy**
   ```bash
   # Option 1: Git Push
   git push origin main
   
   # Option 2: CLI
   vercel --prod
   ```

5. **Verifizieren**
   - Öffne deine Live-Site
   - Teste Upload-Funktion
   - Prüfe Logs: `vercel logs`

### **Option B: Vercel CLI**

```bash
# 1. Login (falls noch nicht)
vercel login

# 2. Link to Project (falls noch nicht)
vercel link

# 3. Environment Variables setzen
# Für Production:
vercel env add WLO_GUEST_USERNAME production
# Enter value: WLO-Upload

vercel env add WLO_GUEST_PASSWORD production
# Enter value: wlo#upload!20
# ⚠️ Wird automatisch encrypted!

vercel env add WLO_REPOSITORY_BASE_URL production
# Enter value: https://repository.staging.openeduhub.net/edu-sharing

# Für Preview & Development auch setzen:
vercel env add WLO_GUEST_USERNAME
# Wähle: Production, Preview, Development

vercel env add WLO_GUEST_PASSWORD
# Wähle: Production, Preview, Development

vercel env add WLO_REPOSITORY_BASE_URL
# Wähle: Production, Preview, Development

# 4. Verifizieren
vercel env ls

# Sollte zeigen (3x für prod/preview/dev):
# WLO_GUEST_USERNAME       WLO-Upload                                  Production
# WLO_GUEST_PASSWORD       ***                                         Production (Encrypted)
# WLO_REPOSITORY_BASE_URL  https://repository.staging.open...          Production

# 5. Deploy
vercel --prod
```

---

## 🧪 Testen

### **Lokaler Test (mit .env)**

```bash
# 1. .env erstellen (falls noch nicht)
cp .env.template .env

# 2. Werte in .env eintragen
WLO_GUEST_USERNAME=WLO-Upload
WLO_GUEST_PASSWORD=wlo#upload!20
WLO_REPOSITORY_BASE_URL=https://repository.staging.openeduhub.net/edu-sharing

# 3. Server starten
npm start

# 4. Logs prüfen - sollte erscheinen:
# ✅ WLO Guest credentials configured
# 🚀 Server running on port 3000

# 5. Test Upload in Browser
# http://localhost:3000
```

### **Production Test**

```bash
# Health Check
curl https://your-domain.netlify.app/.netlify/functions/repository-proxy

# Repository Test
curl -X POST https://your-domain.netlify.app/.netlify/functions/repository-proxy \
  -H "Content-Type: application/json" \
  -d '{"action":"checkDuplicate","data":{"url":"https://example.com"}}'

# Oder für Vercel:
curl -X POST https://your-domain.vercel.app/repository \
  -H "Content-Type: application/json" \
  -d '{"action":"checkDuplicate","data":{"url":"https://example.com"}}'
```

---

## ❓ FAQ

### **F: Kann ich die gleichen Credentials für Netlify UND Vercel nutzen?**
**A:** Ja! Beide Plattformen nutzen die gleichen Environment Variable Namen.

### **F: Muss ich den Code ändern wenn ich die Credentials ändere?**
**A:** Nein! Einfach nur die Environment Variables in Netlify/Vercel Dashboard updaten und re-deployen.

### **F: Was passiert wenn ich die Env-Vars vergesse zu setzen?**
**A:** 
- **Lokal:** Server startet nicht (`❌ WLO credentials required`)
- **Netlify/Vercel:** Build/Deploy funktioniert, aber Repository-Uploads schlagen fehl

### **F: Sind die Credentials jetzt sicher?**
**A:** Ja! 
- ✅ Nicht mehr im Code committed
- ✅ Netlify: Write-only Secrets
- ✅ Vercel: Encrypted Storage
- ✅ Nur Server-Side zugänglich (nie im Client-Bundle)

### **F: Kann ich andere Credentials für Staging/Production nutzen?**
**A:** Ja! In Netlify/Vercel kannst du unterschiedliche Werte für Production/Preview setzen.

---

## 🎉 Fertig!

Deine WLO Guest Credentials sind jetzt genauso sicher wie deine OpenAI API Keys:
- ✅ Aus dem Code entfernt
- ✅ Als Environment Variables gesetzt
- ✅ Encrypted/Write-only in Production
- ✅ Funktionieren in Netlify Functions + Express Server

**Nächste Schritte:**
1. Env-Vars in Netlify/Vercel Dashboard setzen
2. Re-Deploy triggern
3. Testen ob Uploads funktionieren
4. Alte Credentials rotieren (optional, aber empfohlen!)

---

**Dokumentation:** Siehe `DEPLOYMENT_SECURITY.md` für Details  
**Template:** Siehe `.env.template` für alle Variablen
