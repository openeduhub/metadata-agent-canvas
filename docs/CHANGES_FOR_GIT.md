# Änderungen für GitHub Repository

Diese Dateien müssen im Git-Repository aktualisiert werden:

## 1. angular.json

**Zeile 15 ändern:**
```json
"outputPath": "dist",  // WAR: "dist/app"
```

**Zeilen 43-47 hinzufügen (nach "production": {):**
```json
"fileReplacements": [
  {
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.prod.ts"
  }
],
```

**Zeilen 23-27 ändern:**
```json
{
  "glob": "test-sidebar.html",
  "input": "./",
  "output": "./"  // WAR: "../"
}
```

---

## 2. vercel.json

**Zeilen 7-16 ersetzen:**
```json
"rewrites": [
  {
    "source": "/",
    "destination": "/test-sidebar.html"
  },
  {
    "source": "/((?!test-sidebar\\.html|schemata|assets|.*\\.(js|css|png|jpg|jpeg|gif|svg|ico|json)).*)",
    "destination": "/index.html"
  }
],
```

---

## 3. test-sidebar.html

**Zeile 236 ändern:**
```html
src="/index.html"  <!-- WAR: src="/app/" -->
```

---

## 4. src/environments/environment.ts

**Zeile 6 ändern:**
```typescript
apiKey: '', // Add your API key here for local development (will be prompted if empty)
// WAR: apiKey: 'sk-proj-...',
```

**⚠️ WICHTIG: Key muss leer sein!**

---

## 5. src/environments/environment.prod.ts

**Zeile 6 ändern:**
```typescript
apiKey: '', // WICHTIG: Leer lassen! Wird von Vercel zur Build-Zeit injiziert
```

---

## 6. replace-env.js (NEU - siehe separate Datei)

Diese Datei muss komplett ins Repository kopiert werden.

---

## 7. .vercelignore (NEU - überschreiben)

```
# Vercel ignore file
# Only ignore files that should NOT be uploaded to Vercel

# Git files (not needed)
.git

# Environment files with secrets (not needed, we use Vercel env vars)
.env
.env.local

# Development files (not needed)
.vscode/
.idea/

# Build output (not needed, will be built on Vercel)
/dist
/.angular

# Documentation (not needed for build)
*.md
!README.md

# Logs
*.log
```

---

## 8. .gitignore

**Zeilen 48-52 ändern:**
```
# ⚠️ WICHTIG: Keine API Keys committen!
# environment.ts und environment.prod.ts werden beide commitet (OHNE Keys!)
# Für lokale Entwicklung: Kopieren Sie environment.ts lokal und fügen Sie Ihren Key hinzu
# Diese lokale Kopie wird von Git ignoriert wenn Sie Keys enthält
# Keys werden zur Build-Zeit von Vercel injiziert
```

---

## Wichtige neue Dateien:

Diese Dateien sind im `webkomponente-canvas` Ordner und sollten ins Git kopiert werden:

- ✅ `replace-env.js`
- ✅ `DEPLOY.md`
- ✅ `SECURITY_CHECKLIST.md`
- ✅ `src/environments/environment.template.ts`

---

## Nach den Änderungen:

```bash
git add .
git commit -m "Fix: Vercel deployment configuration"
git push
```

Vercel wird dann automatisch neu builden und sollte erfolgreich sein!
