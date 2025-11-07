# 🔧 Vercel Repository Upload Error - Fix

## 🐛 **Fehler:**
```
Create node failed: 400 -
{
  "error":"com.fasterxml.jackson.databind.exc.MismatchedInputException",
  "message":"InvalidLogLevel: Log Level must be at least INFO for showing error messages",
  "stacktrace":null,
  "logLevel":"WARN",
  "details":null,
  "stacktraceArray":null
}
```

**Status:** ⚠️ Repository API lehnt Request ab

---

## 🔍 **Analyse:**

Dieser Fehler tritt bei `createNode` auf und hat **NICHTS mit fehlenden Environment Variables zu tun!**

**Mögliche Ursachen:**

### 1. **Auth funktioniert NICHT** (wahrscheinlichste Ursache)
```javascript
// Vercel Function prüft nicht ob Credentials gesetzt sind!
const GUEST_CONFIG = {
  username: process.env.WLO_GUEST_USERNAME,  // Könnte undefined sein!
  password: process.env.WLO_GUEST_PASSWORD,  // Könnte undefined sein!
  baseUrl: process.env.WLO_REPOSITORY_BASE_URL || 'https://...'
};

// Auth Header wird trotzdem erstellt:
const authHeader = 'Basic ' + Buffer.from(`${GUEST_CONFIG.username}:${GUEST_CONFIG.password}`).toString('base64');
// → 'Basic dW5kZWZpbmVkOnVuZGVmaW5lZA==' (Base64 von "undefined:undefined")
```

**Repository erhält ungültige Auth → gibt kryptischen Fehler zurück!**

---

## ✅ **Lösung 1: Environment Variables prüfen (SOFORT)**

### **Schritt 1: Vercel Dashboard prüfen**
```
1. Gehe zu: https://vercel.com/dashboard
2. Wähle dein Projekt: metadata-agent-canvas
3. Settings → Environment Variables
4. Prüfe ob ALLE gesetzt sind:
   - WLO_GUEST_USERNAME
   - WLO_GUEST_PASSWORD  
   - WLO_REPOSITORY_BASE_URL
```

**Fehlende Variables setzen:**
```
Add New Variable:
  Name: WLO_GUEST_USERNAME
  Value: <your-wlo-username>
  Environments: Production, Preview, Development

Add New Variable:
  Name: WLO_GUEST_PASSWORD
  Value: <your-wlo-password>
  Environments: Production, Preview, Development
  🔒 Klicke "Encrypt"

Add New Variable:
  Name: WLO_REPOSITORY_BASE_URL
  Value: https://repository.staging.openeduhub.net/edu-sharing
  Environments: Production, Preview, Development
```

### **Schritt 2: Re-Deploy**
```bash
# Option A: Git Push
git push origin main

# Option B: Vercel CLI
vercel --prod

# Option C: Dashboard
# → Deployments → ... → Redeploy
```

### **Schritt 3: Test**
Nach Re-Deploy die App testen:
```
https://metadata-agent-canvas.vercel.app
→ Text eingeben
→ Upload versuchen
```

---

## ✅ **Lösung 2: Validation zu Vercel Function hinzufügen**

**Problem:** Vercel Function prüft NICHT ob Credentials gesetzt sind!

**Fix: `api/repository-proxy.js` erweitern:**

```javascript
// WLO Guest credentials from environment variables
const GUEST_CONFIG = {
  username: process.env.WLO_GUEST_USERNAME,
  password: process.env.WLO_GUEST_PASSWORD,
  baseUrl: process.env.WLO_REPOSITORY_BASE_URL || 'https://repository.staging.openeduhub.net/edu-sharing'
};

// ✅ VALIDATE CREDENTIALS (NEU!)
if (!GUEST_CONFIG.username || !GUEST_CONFIG.password) {
  console.error('❌ WLO_GUEST_USERNAME and WLO_GUEST_PASSWORD are required!');
  console.error('   Set these in Vercel Dashboard → Settings → Environment Variables');
}

export default async function handler(req, res) {
  // ✅ CHECK BEFORE PROCESSING (NEU!)
  if (!GUEST_CONFIG.username || !GUEST_CONFIG.password) {
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'WLO Guest credentials not configured. Please contact administrator.',
      hint: 'Set WLO_GUEST_USERNAME and WLO_GUEST_PASSWORD in Vercel environment variables'
    });
  }
  
  // ... rest of code
```

---

## ✅ **Lösung 3: Debug-Logging aktivieren**

**Temporäres Debug-Logging hinzufügen:**

```javascript
export default async function handler(req, res) {
  // DEBUG: Log credentials status (NICHT die echten Werte!)
  console.log('🔍 WLO Config Status:');
  console.log('   Username set:', !!GUEST_CONFIG.username);
  console.log('   Password set:', !!GUEST_CONFIG.password);
  console.log('   Base URL:', GUEST_CONFIG.baseUrl);
  
  if (GUEST_CONFIG.username) {
    console.log('   Username length:', GUEST_CONFIG.username.length);
  }
  if (GUEST_CONFIG.password) {
    console.log('   Password length:', GUEST_CONFIG.password.length);
  }
  
  // ... rest of code
}
```

**Logs prüfen:**
```bash
vercel logs metadata-agent-canvas --prod
```

**Erwartete Ausgabe bei korrekten Credentials:**
```
🔍 WLO Config Status:
   Username set: true
   Password set: true
   Base URL: https://repository.staging.openeduhub.net/edu-sharing
   Username length: 10
   Password length: 13
```

**Ausgabe bei fehlenden Credentials:**
```
🔍 WLO Config Status:
   Username set: false  ← PROBLEM!
   Password set: false  ← PROBLEM!
   Base URL: https://repository.staging.openeduhub.net/edu-sharing
```

---

## 🧪 **Test-Workflow:**

### **1. Environment Variables prüfen via API**
```bash
# Test ob Variables verfügbar sind
curl https://metadata-agent-canvas.vercel.app/api/repository-proxy \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"ping"}'

# Mit Debug-Logging solltest du sehen:
# "Username set: true" oder "Username set: false"
```

### **2. Lokaler Test (zum Vergleich)**
```bash
# .env mit Credentials
WLO_GUEST_USERNAME=<your-wlo-username>
WLO_GUEST_PASSWORD=<your-wlo-password>

# Lokaler Server
npm start

# Test
# → Sollte funktionieren
```

### **3. Vercel Test**
```bash
# Nach Re-Deploy
# https://metadata-agent-canvas.vercel.app
# Upload testen
```

---

## 🎯 **Wahrscheinliche Root Cause:**

```
⚠️  Environment Variables wurden NICHT auf Vercel gesetzt!

Lösung:
1. Vercel Dashboard öffnen
2. Settings → Environment Variables
3. WLO_GUEST_USERNAME setzen
4. WLO_GUEST_PASSWORD setzen (mit 🔒 Encrypt)
5. WLO_REPOSITORY_BASE_URL setzen
6. Re-Deploy
```

---

## 📋 **Quick-Check Checkliste:**

### **Vercel Dashboard:**
- [ ] Settings → Environment Variables öffnen
- [ ] `WLO_GUEST_USERNAME` vorhanden? (Value: <your-wlo-username>)
- [ ] `WLO_GUEST_PASSWORD` vorhanden? (🔒 Encrypted)
- [ ] `WLO_REPOSITORY_BASE_URL` vorhanden? (Value: https://repository.staging.openeduhub.net/edu-sharing)
- [ ] Alle 3 für "Production" Scope?
- [ ] Re-Deploy durchgeführt?

### **Nach Re-Deploy:**
- [ ] Vercel Logs prüfen: `vercel logs --prod`
- [ ] Test-Upload durchführen
- [ ] Fehler verschwunden?

---

## ⚙️ **Alternative: Vercel CLI Setup**

```bash
# 1. Login
vercel login

# 2. Link Project
vercel link

# 3. Environment Variables setzen
vercel env add WLO_GUEST_USERNAME production
# Enter value: <your-wlo-username>

vercel env add WLO_GUEST_PASSWORD production
# Enter value: <your-wlo-password>

vercel env add WLO_REPOSITORY_BASE_URL production
# Enter value: https://repository.staging.openeduhub.net/edu-sharing

# 4. Verify
vercel env ls

# Sollte zeigen:
# WLO_GUEST_USERNAME       <your-wlo-username>                      Production
# WLO_GUEST_PASSWORD       ***                             Production (Sensitive)
# WLO_REPOSITORY_BASE_URL  https://repository.staging...   Production

# 5. Deploy
vercel --prod
```

---

## 🔍 **Root Cause Erklärung:**

**Was passiert:**
1. Frontend ruft `/api/repository-proxy` auf
2. Vercel Function versucht Auth Header zu erstellen:
   ```javascript
   const authHeader = 'Basic ' + Buffer.from(`${undefined}:${undefined}`).toString('base64');
   // → 'Basic dW5kZWZpbmVkOnVuZGVmaW5lZA=='
   ```
3. Repository erhält ungültige Auth
4. Repository gibt kryptischen Fehler zurück statt "401 Unauthorized"

**Warum dieser Fehler?**
- Repository API hat schlechtes Error-Handling
- Gibt internen Jackson-Deserialization-Fehler zurück
- Statt klarem "401 Unauthorized"

**Fix:**
- Environment Variables auf Vercel setzen
- Validation in Function hinzufügen (siehe Lösung 2)

---

## 📚 **Siehe auch:**

- `QUICKSTART_ENV_SETUP.md` - Komplette Anleitung
- `DEPLOYMENT_SECURITY.md` - Vercel Section
- `DOCKER_UPDATE_GUIDE.md` - Environment Variables

---

**Status:** 🟡 Aktion erforderlich  
**Nächster Schritt:** Vercel Dashboard → Environment Variables prüfen/setzen  
**Erwartete Dauer:** 5 Minuten
