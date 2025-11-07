# ⚠️ Special Characters in .env Files

## 🐛 Problem: `#` in WLO Guest Password

Das WLO Guest Password enthält ein `#` Zeichen: `wlo#upload!20`

**dotenv interpretiert `#` als Kommentar-Beginn!**

---

## ❌ **FALSCH - Wird als Kommentar gelesen:**

```env
WLO_GUEST_PASSWORD=wlo#upload!20
                      ↑
                      Alles nach # wird ignoriert!
                      → Nur "wlo" wird gelesen
```

**Ergebnis:**
```javascript
process.env.WLO_GUEST_PASSWORD === "wlo"  // ❌ Nur 3 Zeichen!
```

**Symptom:** HTTP 401 Unauthorized beim Upload

---

## ✅ **RICHTIG - Mit Anführungszeichen:**

```env
WLO_GUEST_PASSWORD="wlo#upload!20"
```

Oder mit Single Quotes:
```env
WLO_GUEST_PASSWORD='wlo#upload!20'
```

**Ergebnis:**
```javascript
process.env.WLO_GUEST_PASSWORD === "wlo#upload!20"  // ✅ Vollständig!
```

---

## 🧪 **Test ob Passwort korrekt geladen wird:**

```bash
node test-wlo-auth.js
```

**Erwartete Ausgabe:**
```
Password length: 13 chars     ← ✅ RICHTIG
Password has # char: Yes      ← ✅ RICHTIG
Password has ! char: Yes      ← ✅ RICHTIG
```

**Falsche Ausgabe (ohne Quotes):**
```
Password length: 3 chars      ← ❌ NUR "wlo"
Password has # char: No       ← ❌ # fehlt
Password has ! char: No       ← ❌ ! fehlt
```

---

## 📋 **Andere Special Characters die Quotes benötigen:**

dotenv behandelt diese Zeichen speziell:

| Zeichen | Problem | Lösung |
|---------|---------|--------|
| `#` | Kommentar-Beginn | **Quotes verwenden!** |
| `$` | Variable Expansion | Quotes oder `\$` |
| `\` | Escape Character | Quotes oder `\\` |
| `` ` `` | Command Substitution | Quotes |
| Leerzeichen | Wird getrimmt | Quotes |
| `"` | String-Delimiter | Single Quotes: `'...'` |
| `'` | String-Delimiter | Double Quotes: `"..."` |

**Best Practice:**
- Komplexe Passwörter **IMMER** in Quotes!
- Einfache Werte (ohne Special Chars) können ohne Quotes

---

## ✅ **Korrekte .env Beispiele:**

```env
# Einfache Werte (keine Quotes nötig)
LLM_PROVIDER=b-api-openai
WLO_GUEST_USERNAME=WLO-Upload

# Komplexe Werte (Quotes erforderlich!)
WLO_GUEST_PASSWORD="wlo#upload!20"
OPENAI_API_KEY="sk-proj-xyz123..."
B_API_KEY="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# URLs (meistens keine Quotes nötig, aber empfohlen)
WLO_REPOSITORY_BASE_URL="https://repository.staging.openeduhub.net/edu-sharing"

# Strings mit Leerzeichen (Quotes erforderlich!)
APP_NAME="Metadata Agent Canvas"

# Strings mit $ (Quotes erforderlich!)
DATABASE_PASSWORD="my$ecretP@ss"
```

---

## 🔍 **Debugging: Wie prüfe ich geladene Werte?**

### **Option 1: test-wlo-auth.js Script**
```bash
node test-wlo-auth.js
```

### **Option 2: Node Console**
```bash
node
> require('dotenv').config()
> process.env.WLO_GUEST_PASSWORD
'wlo#upload!20'  // ← Sollte vollständig sein!
```

### **Option 3: Server Logs**
Beim Server-Start sollte erscheinen:
```
✅ WLO Guest credentials configured
```

Falls nicht:
```
❌ WLO credentials required
```

---

## 📚 **dotenv Dokumentation:**

**Von dotenv README:**
> Comments begin where a `#` exists, so if your value contains a `#` please wrap it in quotes.

**Beispiele aus dotenv:**
```env
# ❌ Falsch
SECRET_HASH=something-with-a-#-hash

# ✅ Richtig
SECRET_HASH="something-with-a-#-hash"
```

---

## 🔄 **Nach .env Änderung:**

**IMMER Server neu starten!**

dotenv lädt `.env` nur beim Prozess-Start, nicht dynamisch!

```bash
# Terminal 1 (Server)
Ctrl+C  # Server stoppen
npm start  # Neu starten

# Terminal 2 (Test)
node test-wlo-auth.js
```

---

## ✅ **Checkliste nach Problem-Behebung:**

- [ ] `.env` hat `WLO_GUEST_PASSWORD="wlo#upload!20"` (mit Quotes!)
- [ ] Server neu gestartet
- [ ] `node test-wlo-auth.js` zeigt "Password length: 13 chars"
- [ ] Server-Log zeigt "✅ WLO Guest credentials configured"
- [ ] Upload funktioniert (kein HTTP 401 mehr)

---

## 🎯 **Zusammenfassung:**

**Problem:** `#` in Passwort wird als Kommentar interpretiert  
**Lösung:** Passwort in Anführungszeichen setzen  
**Prävention:** Alle Templates haben jetzt Quotes + Hinweis  

---

**Referenzen:**
- dotenv: https://github.com/motdotla/dotenv
- Breaking Change (v15.0.0): `#` jetzt Kommentar-Delimiter
