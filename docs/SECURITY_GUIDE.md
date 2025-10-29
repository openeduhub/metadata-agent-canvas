# Security Guide

**Sichere Verwaltung von API-Keys und Secrets**

---

## 🔐 Security Principles

### Zero-Trust Architecture

**Regel #1:** API-Keys dürfen **NIEMALS** im Frontend-Code erscheinen!

```
❌ NIEMALS:                          ✅ IMMER:
- Keys in Git committen              - .env für lokale Entwicklung
- Keys in environment.ts/prod.ts     - Environment Variables für Deployment
- Keys in Bundle (dist/)             - Secrets als "write-only" (Netlify)
- Keys in Public URLs                - API-Keys server-side (Functions)
```

---

## 🏗️ Architektur

### API-Key Flow

```
User Browser (Frontend)
  ↓ (ohne API-Key!)
  ↓ POST /llm
  ↓
Netlify/Vercel Function (Backend)
  ↓ (liest API-Key aus process.env)
  ↓ POST https://api.openai.com/v1/chat/completions
  ↓ (mit Authorization Header)
  ↓
OpenAI API
  ↓
  ← Response
  ←
Netlify/Vercel Function
  ←
  ←
User Browser ✅
```

**Wichtig:** API-Key verlässt **nie** das Backend!

---

## 🔑 API-Key Management

### Lokale Entwicklung

**1. `.env` File erstellen:**

```bash
cp .env.template .env
```

**2. Keys eintragen:**

```bash
# .env
OPENAI_API_KEY=sk-proj-xxxxxxxx...
B_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
B_API_USERNAME=your-username
B_API_PASSWORD=your-password
```

**3. .gitignore prüfen:**

```bash
# MUSS in .gitignore sein:
.env
.env.local
.env*.local
```

**4. Nie committen:**

```bash
git status
# .env sollte NICHT erscheinen

# Falls doch:
git rm --cached .env
echo ".env" >> .gitignore
```

---

### Production (Netlify)

**1. Secrets Controller nutzen:**

```bash
# API-Keys als Secrets (write-only!)
netlify env:set OPENAI_API_KEY "sk-proj-..." --secret
netlify env:set B_API_KEY "uuid-key" --secret
netlify env:set B_API_PASSWORD "password" --secret
```

**Was ist ein Secret?**
- ✅ Write-only (kann nach Speichern NICHT mehr gelesen werden)
- ✅ Automatisches Scanning vor jedem Build
- ✅ Build fails wenn Secret geleakt wird
- ✅ Nie im Build Log sichtbar

**2. Secrets Controller aktivieren:**

Im Netlify Dashboard:
- Site Settings → Build & deploy → Environment
- Secret scanning: **Enabled** ✅
- Block builds with secrets: **Enabled** ✅
- Smart detection: **Enabled** ✅

**3. Normale Variables:**

```bash
# Nicht-sensitive Werte (OHNE --secret)
netlify env:set DEPLOYMENT_PLATFORM "netlify"
netlify env:set LLM_PROVIDER "b-api-openai"
netlify env:set B_API_BASE_URL "https://repository.staging.openeduhub.net"
```

---

### Production (Vercel)

**1. Environment Variables setzen:**

Im Vercel Dashboard:
- Settings → Environment Variables

| Key | Value | Environment |
|-----|-------|-------------|
| `OPENAI_API_KEY` | `sk-proj-...` | Production, Preview |
| `B_API_KEY` | `uuid-key` | Production, Preview |
| `B_API_PASSWORD` | `password` | Production, Preview |

**2. Sensitive markieren:**

Vercel markiert API-Keys automatisch als "Sensitive" (ähnlich wie Netlify Secrets)

---

## 🚨 Secret Scanning

### Netlify Secrets Controller

**Wie es funktioniert:**

```
1. Deployment startet
2. Secrets Controller scannt Code & Dependencies
3. Prüft auf bekannte Secret-Patterns:
   - OpenAI Keys (sk-proj-*, sk-*)
   - UUID Keys
   - Base64-encoded Secrets
   - URI-encoded Secrets
4. Falls Secret gefunden:
   → Build FAILS ❌
   → Deployment wird verhindert
5. Falls kein Secret gefunden:
   → Build continues ✅
```

**Build Log:**

```bash
✓ Secret scanning: No secrets found
✓ Build successful
```

**Falls Secret gefunden:**

```bash
❌ Secret scanning: Secret detected in file src/environments/environment.prod.ts
❌ Build failed: Preventing deployment to protect your secrets
```

---

### Manuelle Prüfung

**Vor Commit:**

```bash
# Prüfe Source Code
grep -r "sk-proj" src/
grep -r "sk-" src/environments/

# Prüfe Build
npm run build
grep -r "sk-proj" dist/
grep -r "apiKey" dist/ | grep -v '""'

# Sollte NICHTS finden!
```

---

## ✅ Security Checklist

### Vor Deployment

- [ ] `.env` ist in `.gitignore`
- [ ] Keine API-Keys in Git-History
- [ ] `environment.prod.ts` hat `apiKey: ''` (leer)
- [ ] Secrets als "Secret" markiert (Netlify) oder "Sensitive" (Vercel)
- [ ] Secret Scanning aktiviert (Netlify)
- [ ] Manuelle Prüfung: `grep -r "sk-" src/` → NICHTS

### Nach Deployment

- [ ] Build Log prüfen: "No secrets found" ✅
- [ ] Netzwerk-Tab öffnen: Keine API-Keys in Requests
- [ ] Bundle inspizieren: `curl <app-url> | grep "sk-proj"` → NICHTS
- [ ] Functions testen: API-Calls funktionieren
- [ ] Error-Handling testen: Ungültige Keys werden abgefangen

---

## 🛡️ Best Practices

### 1. Environment Files

```typescript
// ✅ RICHTIG - environment.prod.ts
export const environment = {
  production: true,
  openai: {
    apiKey: '',  // ← LEER!
    proxyUrl: '',  // ← Wird von PlatformDetectionService gesetzt
  }
};
```

```typescript
// ❌ FALSCH - environment.prod.ts
export const environment = {
  production: true,
  openai: {
    apiKey: 'sk-proj-xxxxx...',  // ← NIEMALS!
  }
};
```

---

### 2. .env Template

**Erstelle `.env.template` für Team:**

```bash
# .env.template (OHNE echte Keys!)
OPENAI_API_KEY=sk-proj-your-key-here
B_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
B_API_USERNAME=your-username
B_API_PASSWORD=your-password
B_API_BASE_URL=https://repository.staging.openeduhub.net

# Deployment Platform (local | netlify | vercel)
DEPLOYMENT_PLATFORM=local

# LLM Provider (b-api-openai | b-api-academic-cloud | openai)
LLM_PROVIDER=b-api-openai
```

**Team-Mitglieder:**

```bash
cp .env.template .env
# Keys eintragen
```

---

### 3. Dokumentation

**❌ NIEMALS echte Key-Fragmente in Docs:**

```markdown
❌ FALSCH:
OPENAI_API_KEY=sk-proj-fGvdFrf8ZApf...  ← Echtes Fragment!
B_API_KEY=bb6cdf84-0a9d-47f3-b673-c1b4f25b9bdc  ← Echte UUID!

✅ RICHTIG:
OPENAI_API_KEY=sk-proj-xxxxxxxx...
B_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Regel:** Mindestens 8 Zeichen eines Keys = kritisches Fragment!

---

### 4. Git History

**Falls Keys versehentlich committet:**

```bash
# Letzten Commit rückgängig (nicht pushed)
git reset --soft HEAD~1

# Falls bereits pushed (⚠️ vorsichtig!)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force-Push (⚠️ Team informieren!)
git push origin --force --all

# Key SOFORT ROTIEREN!
# OpenAI: Neuen Key generieren, alten revoken
# B-API: Admin kontaktieren
```

**Besser:** `git-secrets` oder `gitleaks` nutzen (Pre-Commit Hook)

---

## 🔍 Sicherheitsaudit

### Automated Tools

**1. git-secrets (Pre-Commit Hook):**

```bash
# Installieren
brew install git-secrets  # macOS
# oder
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets
make install

# Setup
git secrets --install
git secrets --register-aws  # AWS Keys
git secrets --add 'sk-proj-[A-Za-z0-9]+'  # OpenAI Keys
git secrets --add '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'  # UUIDs

# Testen
git secrets --scan
```

**2. gitleaks (CI/CD):**

```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: gitleaks/gitleaks-action@v2
```

---

### Manual Audit

**Checkliste:**

```bash
# 1. Source Code
grep -r "sk-proj" src/
grep -r "apiKey.*:" src/ | grep -v '""'

# 2. Build Output
npm run build
grep -r "sk-proj" dist/
grep -r "apiKey" dist/

# 3. Git History
git log -p --all | grep -i "sk-proj"
git log -p --all | grep -i "apiKey"

# 4. Dependencies
npm audit
npm audit fix

# Sollte ALLES leer sein!
```

---

## 🚨 Incident Response

### Falls API-Key geleakt

**1. SOFORT Key rotieren:**

**OpenAI:**
- https://platform.openai.com/api-keys
- "Revoke" auf alten Key
- Neuen Key generieren

**B-API:**
- Admin kontaktieren
- Neuen Key anfordern

**2. Environment Variables updaten:**

```bash
# Netlify
netlify env:set OPENAI_API_KEY "sk-proj-NEW-KEY" --secret

# Vercel
# Dashboard → Settings → Environment Variables → Edit
```

**3. Re-Deploy:**

```bash
netlify deploy --prod
# oder
vercel --prod
```

**4. Git History cleanen** (siehe oben)

**5. Monitoring:**

- Prüfe API-Usage auf OpenAI/B-API Dashboard
- Ungewöhnliche Aktivitäten?
- Kosten-Spikes?

---

## 📚 Weitere Ressourcen

### Netlify
- [Secrets Controller](https://docs.netlify.com/environment-variables/secret-controller/)
- [Environment Variables Security](https://docs.netlify.com/environment-variables/overview/#secret-variables)

### Vercel
- [Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Sensitive Environment Variables](https://vercel.com/docs/projects/environment-variables#sensitive-environment-variables)

### OpenAI
- [API Key Best Practices](https://platform.openai.com/docs/guides/production-best-practices/api-keys)
- [Safety Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)

### Tools
- [git-secrets](https://github.com/awslabs/git-secrets)
- [gitleaks](https://github.com/gitleaks/gitleaks)
- [truffleHog](https://github.com/trufflesecurity/trufflehog)

### Projekt-Docs
- [SECURE_API_KEY_ARCHITECTURE.md](./SECURE_API_KEY_ARCHITECTURE.md)
- [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md)
- [NETLIFY_SECRETS_CONTROLLER.md](./NETLIFY_SECRETS_CONTROLLER.md)

---

**🔒 Security ist keine Option, sondern Pflicht!**
