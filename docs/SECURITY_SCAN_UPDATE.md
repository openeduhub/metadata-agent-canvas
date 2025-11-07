# 🔐 Security Scan Update - WLO Credentials

## ⚠️ PROBLEM: Prüfskripte scannen NUR OpenAI/B-API Keys

**Status:** 🟡 **LÜCKE GEFUNDEN**

Die bestehenden Security-Scans (Netlify Secret Scanning) prüfen **NICHT** auf WLO Guest Credentials!

---

## 📊 Aktuelle Situation

### ✅ Was wird gescannt:
| Credential Type | Pattern | Netlify Scan | Grund |
|----------------|---------|--------------|-------|
| **OpenAI API Key** | `sk-proj-...` | ✅ JA | Markiert als "Sensitive variable" |
| **B-API Key** | `xxxxxxxx-xxxx-...` (UUID) | ✅ JA | Markiert als "Sensitive variable" |

### ❌ Was wird NICHT gescannt:
| Credential Type | Value | Netlify Scan | Risiko |
|----------------|-------|--------------|--------|
| **WLO Username** | `<your-wlo-username>` | ❌ NEIN | **MITTEL** - Public identifier |
| **WLO Password** | `<your-wlo-password>` | ❌ NEIN | **HOCH** - Sensitive credential! |

---

## 🎯 Warum ist das ein Problem?

**WLO Password ist NICHT automatisch geschützt:**
```javascript
// ❌ Falls versehentlich im Code:
const password = "<your-wlo-password>";  // Netlify Secret Scan würde das NICHT finden!

// ✅ OpenAI wird erkannt:
const apiKey = "sk-proj-xyz123...";  // Netlify Secret Scan würde das finden
```

**Grund:**
- Netlify scannt nur Variablen die als **"Sensitive variable"** markiert sind
- Oder Patterns die wie bekannte API-Keys aussehen (`sk-`, UUID-Format, etc.)
- **Ein einfaches Passwort wie `<your-wlo-password>` entspricht keinem bekannten Pattern!**

---

## ✅ Lösung: WLO Password als Secret markieren

### Option A: Netlify Dashboard (Empfohlen)

**1. Gehe zu Netlify Dashboard**
```
Site Settings → Environment Variables → WLO_GUEST_PASSWORD
```

**2. Editiere die Variable:**
- Klicke auf "..." neben `WLO_GUEST_PASSWORD`
- Klicke "Edit"
- ✅ **Aktiviere "Contains secret values"**
- Save

**3. Verifiziere:**
Nach dem nächsten Deploy sollte im Build-Log erscheinen:
```
🔍 Scanning for secrets...
✅ Secret scanning: Checked WLO_GUEST_PASSWORD
✅ No secrets found in bundle
```

---

### Option B: Netlify CLI

**Neu setzen mit --secret Flag:**
```bash
# Alte Variable löschen
netlify env:unset WLO_GUEST_PASSWORD

# Neu setzen mit --secret
netlify env:set WLO_GUEST_PASSWORD "<your-wlo-password>" --secret
```

**Verifizieren:**
```bash
netlify env:list

# Output sollte zeigen:
# WLO_GUEST_PASSWORD = (secret)  ← "secret" Indikator!
```

---

## 🔍 Zusätzliche Scan-Empfehlungen

### 1. Manueller Pre-Commit Scan

**Erstelle Git Pre-Commit Hook:**
```bash
# .git/hooks/pre-commit
#!/bin/bash

echo "🔍 Scanning for WLO credentials..."

# Suche nach WLO Password Pattern
if git diff --cached | grep -i "wlo#upload"; then
    echo "❌ ERROR: WLO password found in commit!"
    echo "   Remove credential before committing."
    exit 1
fi

# Suche nach WLO Username (weniger kritisch, aber trotzdem prüfen)
if git diff --cached | grep -E "username.*<your-wlo-username>|<your-wlo-username>.*password"; then
    echo "⚠️  WARNING: WLO username pattern found"
    echo "   Verify this is in .env or documentation only"
fi

echo "✅ No WLO credentials found"
exit 0
```

**Aktivieren:**
```bash
chmod +x .git/hooks/pre-commit
```

---

### 2. GitHub Actions Secret Scan (für GitHub Repos)

**`.github/workflows/security-scan.yml`:**
```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Scan for WLO Credentials
        run: |
          echo "🔍 Scanning for exposed credentials..."
          
          # Scan für WLO Password
          if grep -r "wlo#upload" --include="*.js" --include="*.ts" --include="*.json" .; then
            echo "❌ FAIL: WLO password found in code!"
            exit 1
          fi
          
          # Scan für hardcodierte WLO Username (außer in Doku/Templates)
          if grep -r "<your-wlo-username>" --include="*.js" --include="*.ts" --exclude-dir=docs --exclude="*.template" .; then
            echo "❌ FAIL: Hardcoded WLO username found!"
            exit 1
          fi
          
          echo "✅ PASS: No credentials exposed"
```

---

### 3. Package.json Script

**Füge zu `package.json` hinzu:**
```json
{
  "scripts": {
    "security:scan": "node scripts/security-scan.js",
    "precommit": "npm run security:scan"
  }
}
```

**`scripts/security-scan.js`:**
```javascript
#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 Running security credential scan...\n');

const patterns = [
  { pattern: 'wlo#upload', severity: 'HIGH', name: 'WLO Password' },
  { pattern: 'sk-proj-', severity: 'HIGH', name: 'OpenAI API Key' },
  { pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', severity: 'MEDIUM', name: 'UUID (potential B-API Key)' }
];

let foundIssues = false;

patterns.forEach(({ pattern, severity, name }) => {
  try {
    const result = execSync(
      `grep -r "${pattern}" --include="*.js" --include="*.ts" --include="*.json" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=docs src/ server/ api/ netlify/functions/ || true`,
      { encoding: 'utf8' }
    );
    
    if (result.trim()) {
      console.log(`❌ ${severity}: ${name} found in code:`);
      console.log(result);
      foundIssues = true;
    }
  } catch (error) {
    // grep returns exit code 1 if no matches (which is good)
  }
});

if (foundIssues) {
  console.log('\n❌ Security scan FAILED: Credentials found in code!');
  process.exit(1);
} else {
  console.log('✅ Security scan PASSED: No credentials found\n');
  process.exit(0);
}
```

**Ausführen:**
```bash
npm run security:scan
```

---

## 📋 Checkliste für vollständige Absicherung

- [ ] **Netlify:** `WLO_GUEST_PASSWORD` als "Sensitive variable" markiert
- [ ] **Git Hook:** Pre-commit scan für WLO Credentials installiert
- [ ] **Package.json:** `security:scan` Script hinzugefügt
- [ ] **GitHub Actions:** Security Scan Workflow erstellt (falls GitHub)
- [ ] **Dokumentation:** Team über neue Scan-Prozesse informiert
- [ ] **Test:** Manuell WLO Password in Test-Datei einfügen und prüfen ob Scan triggert

---

## 🧪 Test der Scans

**1. Test Pre-Commit Hook:**
```bash
# Erstelle Test-Datei mit Credential
echo 'const pass = "<your-wlo-password>";' > test-credential.js
git add test-credential.js
git commit -m "test"

# Erwartung: ❌ Commit wird blockiert

# Cleanup
rm test-credential.js
```

**2. Test npm Script:**
```bash
# Erstelle Test-Datei
echo 'const pass = "<your-wlo-password>";' > src/test.ts

# Run Scan
npm run security:scan

# Erwartung: ❌ Exit code 1 (Fehler)

# Cleanup
rm src/test.ts
```

**3. Test Netlify Build:**
```bash
# Nach Markierung als Secret in Dashboard:
# Trigger neuen Deploy
netlify deploy --prod

# Check Build-Log:
# Sollte zeigen: "✅ Secret scanning: No secrets found"
```

---

## 🎯 Zusammenfassung

| Maßnahme | Status | Priorität |
|----------|--------|-----------|
| **Netlify Secret Marking** | ⚠️ TODO | 🔴 HOCH |
| **Git Pre-Commit Hook** | ⚠️ TODO | 🟡 MITTEL |
| **npm security:scan** | ⚠️ TODO | 🟡 MITTEL |
| **GitHub Actions** | ⚠️ TODO | 🟢 NIEDRIG |

**Nächster Schritt:**
1. WLO_GUEST_PASSWORD in Netlify Dashboard als "Sensitive variable" markieren
2. Re-Deploy triggern
3. Build-Log prüfen

**Fertig!** Dann sind WLO Credentials genauso sicher wie OpenAI Keys! 🎉

---

**Erstellt:** 2025-01-07  
**Autor:** Security Audit  
**Status:** 🟡 Action Required
