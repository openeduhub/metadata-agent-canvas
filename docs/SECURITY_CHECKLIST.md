# 🔐 Sicherheits-Checkliste vor Git Commit

## ✅ VOR jedem Commit prüfen:

### 1. Keine API-Keys im Code!

```bash
# Prüfen Sie diese Dateien:
cat src/environments/environment.ts
cat src/environments/environment.prod.ts
```

**Beide Dateien müssen haben:**
```typescript
apiKey: '',  // Leer!
```

**NIEMALS committen:**
```typescript
apiKey: 'sk-proj-...',  // ❌ FALSCH!
```

---

### 2. .gitignore ist korrekt

**Diese Dateien NICHT im Git:**
- ✅ `src/environments/environment.ts` (in .gitignore)
- ✅ `.env`
- ✅ `.env.local`

**Diese Datei MUSS im Git sein (aber OHNE Key):**
- ✅ `src/environments/environment.prod.ts` (MIT leerem apiKey)

---

### 3. Vor Commit: Keys entfernen

```bash
# 1. Öffnen Sie environment.prod.ts
# 2. Stellen Sie sicher: apiKey: ''
# 3. Speichern

# 4. Prüfen was commited wird:
git diff src/environments/environment.prod.ts

# 5. Sicherstellen: Kein Key sichtbar!
```

---

## 🚀 Workflow: Lokale Entwicklung

### Development (lokal):

**`src/environments/environment.ts`:**
```typescript
export const environment = {
  production: false,
  openai: {
    apiKey: 'sk-proj-...', // Ihr echter Key für lokales Testen
    // ...
  }
};
```

**Status:** ✅ In .gitignore → Wird NICHT commited

---

### Production (Vercel):

**`src/environments/environment.prod.ts`:**
```typescript
export const environment = {
  production: true,
  openai: {
    apiKey: '', // Leer!
    // ...
  }
};
```

**Status:** ✅ Wird commited (ohne Key)

**Vercel Environment Variable:**
```
OPENAI_API_KEY = sk-proj-...  (in Vercel Dashboard)
```

**Zur Build-Zeit:** `replace-env.js` injiziert den Key

---

## 🔍 Sicherheits-Scan vor Commit

```bash
# Prüfen auf versehentlich commitete Keys:
git grep -i "sk-proj-" src/
git grep -i "sk-" src/environments/

# Sollte NICHTS finden!
```

---

## ❌ Was NIEMALS ins Git darf:

- ❌ OpenAI API Keys
- ❌ Jegliche Secrets/Tokens
- ❌ Passwörter
- ❌ Private Keys
- ❌ `.env` Dateien mit Secrets

---

## ✅ Was ins Git darf:

- ✅ `environment.prod.ts` mit `apiKey: ''`
- ✅ `replace-env.js` (injiziert Keys zur Build-Zeit)
- ✅ `vercel.json` (Konfiguration)
- ✅ Code, Tests, Dokumentation

---

## 🚨 Falls versehentlich Key commited:

### Sofort-Maßnahmen:

```bash
# 1. Key in OpenAI Dashboard SOFORT deaktivieren!
# 2. Neuen Key erstellen
# 3. Git History bereinigen:
git reset HEAD~1  # Letzten Commit rückgängig
# Oder:
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch src/environments/environment.prod.ts" \
  --prune-empty --tag-name-filter cat -- --all

# 4. Mit leerem Key neu committen
# 5. Force push (VORSICHT!)
git push origin main --force
```

**Besser:** History ist kompromittiert → Neues Repository erstellen!

---

## 🔐 Best Practices

### 1. Zwei Environment-Dateien:

| Datei | In Git? | API-Key | Verwendung |
|-------|---------|---------|------------|
| `environment.ts` | ❌ Nein | ✅ Ja (lokal) | Development |
| `environment.prod.ts` | ✅ Ja | ❌ Nein (leer) | Production |

### 2. Vercel Environment Variables:

- Zentral in Vercel Dashboard
- Nicht im Code
- Nur zur Build-Zeit sichtbar

### 3. Regelmäßig prüfen:

```bash
# Vor jedem Commit:
git status
git diff
# Prüfen: Keine Keys sichtbar?
```

---

## 📋 Commit-Checkliste

Vor jedem `git commit`:

- [ ] `environment.prod.ts` hat leeren apiKey
- [ ] Keine Keys in anderen Dateien
- [ ] `.gitignore` ist korrekt
- [ ] `git diff` zeigt keine Secrets
- [ ] Commit-Message ist klar

Dann:
```bash
git add .
git commit -m "Deine Message"
git push
```

---

**Sicherheit hat Priorität! Lieber zweimal prüfen! 🔐**
