# Contributing Guide

Danke für dein Interesse an Metadata Agent Canvas! 🎉

---

## 📋 Code of Conduct

- Sei respektvoll und konstruktiv
- Hilf anderen beim Lernen
- Teile dein Wissen
- Akzeptiere konstruktive Kritik

---

## 🚀 Quick Start

### 1. Fork & Clone

```bash
# Fork auf GitHub
# Dann klonen:
git clone https://github.com/YOUR-USERNAME/metadata-agent.git
cd metadata-agent/webkomponente-canvas
```

### 2. Setup

```bash
# Dependencies installieren
npm install

# Environment konfigurieren
cp .env.template .env
# Keys eintragen in .env

# Development Server starten
npm start
```

### 3. Branch erstellen

```bash
git checkout -b feature/my-new-feature
# oder
git checkout -b fix/bug-description
```

---

## 🎯 Was kannst du beitragen?

### 🐛 Bug Fixes

**Gefunden einen Bug?**

1. **Prüfe** ob Issue bereits existiert
2. **Erstelle** neues Issue mit:
   - Beschreibung des Problems
   - Schritte zum Reproduzieren
   - Erwartetes vs. aktuelles Verhalten
   - Screenshots (falls hilfreich)
   - Browser/OS Version

### ✨ Features

**Neue Feature-Idee?**

1. **Erstelle** Issue mit Feature Request
2. **Diskutiere** Design & Implementierung
3. **Warte** auf Approval vor großer Arbeit
4. **Implementiere** nach Approval

### 📚 Dokumentation

**Dokumentation verbessern:**

- Typos korrigieren
- Beispiele hinzufügen
- Erklärungen verbessern
- Neue Guides schreiben
- Übersetzungen hinzufügen

### 🌐 i18n/Übersetzungen

**Neue Sprache hinzufügen:**

1. Neue Datei: `src/assets/i18n/XX.json`
2. Alle Keys aus `de.json` kopieren
3. Werte übersetzen
4. `I18nService` updaten

**Siehe:** [INTERNATIONALIZATION.md](./docs/INTERNATIONALIZATION.md)

---

## 💻 Development Guidelines

### Code Style

**TypeScript:**

```typescript
// ✅ RICHTIG
const user: User = {
  name: 'Max',
  age: 25
};

// ❌ FALSCH
const user: any = {
  name: 'Max',
  age: 25
};
```

**Angular Components:**

```typescript
// ✅ RICHTIG - OnPush Change Detection
@Component({
  selector: 'app-my-component',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

// ✅ RICHTIG - Unsubscribe mit takeUntil
this.observable$
  .pipe(takeUntil(this.destroy$))
  .subscribe();
```

**Naming Conventions:**

```typescript
// Components
export class UserProfileComponent { }

// Services
export class AuthService { }

// Interfaces
export interface User { }

// Constants
export const API_BASE_URL = 'https://...';

// Variables
const userName = 'Max';
let isLoggedIn = false;
```

---

### Testing

**Unit Tests sind Pflicht für:**
- Neue Services
- Neue Components
- Bug Fixes
- Business Logic

**Beispiel:**

```typescript
describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(I18nService);
  });

  it('should switch language', () => {
    service.setLanguage('en');
    expect(service.getCurrentLanguage()).toBe('en');
  });

  it('should persist language in localStorage', () => {
    service.setLanguage('en');
    const stored = localStorage.getItem('app_language');
    expect(stored).toBe('en');
  });
});
```

**Tests ausführen:**

```bash
ng test
```

---

### Commit Messages

**Format:** Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: Neues Feature
- `fix`: Bug Fix
- `docs`: Nur Dokumentation
- `style`: Code-Formatierung (keine Logik-Änderung)
- `refactor`: Code-Refactoring
- `test`: Tests hinzufügen/ändern
- `chore`: Build/Dependencies

**Beispiele:**

```bash
# Feature
git commit -m "feat(i18n): add French translation support"

# Bug Fix
git commit -m "fix(canvas): resolve field value reset on language switch"

# Dokumentation
git commit -m "docs(readme): update installation instructions"

# Refactoring
git commit -m "refactor(services): extract common logic to base class"
```

---

### Pull Request Process

**1. Code vorbereiten:**

```bash
# Neueste Änderungen holen
git checkout main
git pull upstream main

# Feature Branch aktualisieren
git checkout feature/my-feature
git rebase main

# Konflikte lösen falls nötig
```

**2. Tests durchführen:**

```bash
# Unit Tests
npm test

# Build testen
npm run build

# Linting
npm run lint
```

**3. Pull Request erstellen:**

**Titel:**
```
feat(i18n): add French translation support
```

**Beschreibung:**

```markdown
## What
Adds French translation support to the app.

## Why
Requested by users in issue #123.

## How
- Created `src/assets/i18n/fr.json`
- Updated `I18nService` to support 'fr'
- Added French flag to Language Switcher

## Testing
- [ ] Unit tests pass
- [ ] Build successful
- [ ] Manual testing (Language Switcher)
- [ ] All UI elements translated

## Screenshots
[Attach screenshots if UI changes]

## Related Issues
Closes #123
```

**4. Review Process:**

- Maintainer reviewed Code
- Feedback adressieren
- Tests müssen grün sein
- Mindestens 1 Approval

**5. Merge:**

- Squash Merge (mehrere Commits → 1)
- Delete Branch nach Merge

---

## 🔐 Security

### API-Keys

**❌ NIEMALS:**
- API-Keys in Git committen
- API-Keys in Code hardcoden
- API-Keys in Dokumentation (auch nicht Fragmente!)

**✅ IMMER:**
- `.env` für lokale Keys nutzen
- Environment Variables für Deployment
- Secrets als "write-only" markieren

**Prüfen vor Commit:**

```bash
# Prüfe auf geleakte Keys
grep -r "sk-proj" src/
grep -r "apiKey" src/ | grep -v '""'

# Sollte NICHTS finden!
```

**Siehe:** [SECURITY_GUIDE.md](./docs/SECURITY_GUIDE.md)

---

### Dependency Security

**Prüfe regelmäßig:**

```bash
npm audit
npm audit fix
```

**Updates:**

```bash
npm outdated
npm update
```

---

## 📚 Dokumentation

### Wann dokumentieren?

**IMMER bei:**
- Neuen Features
- API-Änderungen
- Breaking Changes
- Neuen Environment Variables
- Schema-Änderungen

**Wo dokumentieren?**

- **README.md** - Feature-Übersicht
- **CHANGELOG.md** - Version & Änderungen
- **docs/** - Detaillierte Guides
- **Code** - JSDoc Comments

### JSDoc Comments

```typescript
/**
 * Lokalisiert einen String oder ein i18n-Objekt.
 * 
 * @param value String oder {de: "...", en: "..."}
 * @param language Zielsprache ('de' | 'en')
 * @returns Lokalisierter String
 * 
 * @example
 * localizeString({de: "Titel", en: "Title"}, 'en')
 * // Returns: "Title"
 */
localizeString(value: string | I18nObject, language: string): string {
  // ...
}
```

---

## 🎨 UI/UX Guidelines

### Material Design v3

**Folge MD3 Guidelines:**
- Konsistente Farben (`--md-sys-color-*`)
- Konsistente Shapes (`--md-sys-shape-corner-*`)
- Konsistente Elevation
- Konsistente Typography

**Beispiel:**

```scss
.my-button {
  background: var(--md-sys-color-primary);
  border-radius: var(--md-sys-shape-corner-medium);
  box-shadow: var(--md-sys-elevation-level-2);
  
  &:hover {
    box-shadow: var(--md-sys-elevation-level-3);
  }
}
```

### Accessibility (a11y)

**Beachte:**
- Keyboard-Navigation
- Screen Reader Support
- Kontraste (WCAG AA)
- Focus Indicators
- ARIA Labels

```html
<!-- ✅ RICHTIG -->
<button 
  aria-label="Metadaten extrahieren"
  (click)="startExtraction()">
  Extrahieren
</button>

<!-- ❌ FALSCH -->
<div (click)="startExtraction()">
  Extrahieren
</div>
```

---

## 🐛 Bug Fixing Process

### 1. Reproduzieren

```bash
# Schritte dokumentieren
1. Öffne App
2. Wähle Content-Type "Event"
3. Klicke "Extrahieren"
4. Error: "Cannot read property 'label' of undefined"
```

### 2. Debuggen

```typescript
// Add console.logs
console.log('Field:', field);
console.log('Label:', field?.label);

// Oder Debugger
debugger;
```

### 3. Fix implementieren

```typescript
// ❌ VORHER
const label = field.label.de;

// ✅ NACHHER
const label = field?.label?.de || 'Unnamed Field';
```

### 4. Test schreiben

```typescript
it('should handle missing label gracefully', () => {
  const field = { id: 'test' };  // Kein label!
  const result = component.getFieldLabel(field);
  expect(result).toBe('Unnamed Field');
});
```

### 5. Dokumentieren

```markdown
## Bug Fix: Null-Pointer bei fehlendem Label

**Problem:** App crashed wenn Feld kein `label` hatte.

**Root Cause:** Kein null-check in `getFieldLabel()`.

**Solution:** Optional chaining + Fallback-Wert.

**Testing:** Unit test hinzugefügt.
```

---

## 📊 Performance

### Guidelines

**Vermeide:**
- Synchrones Rendering von großen Listen
- Unnötige Change Detection
- Memory Leaks (unsubscribed Observables)

**Nutze:**
- `trackBy` für `*ngFor`
- `OnPush` Change Detection
- Virtual Scrolling für lange Listen
- Lazy Loading

**Beispiel:**

```typescript
// ✅ RICHTIG - TrackBy Function
trackByFieldId(index: number, field: CanvasField): string {
  return field.fieldId;
}

// Template
<div *ngFor="let field of fields; trackBy: trackByFieldId">
```

---

## 🔄 Review Process

### Was wird geprüft?

**Code Quality:**
- Code Style konsistent?
- Best Practices befolgt?
- Keine Code-Smells?

**Funktionalität:**
- Feature funktioniert wie beschrieben?
- Edge Cases behandelt?
- Error Handling vorhanden?

**Tests:**
- Tests vorhanden?
- Tests aussagekräftig?
- Coverage ausreichend?

**Dokumentation:**
- Neues Feature dokumentiert?
- README updated (falls nötig)?
- Changelog updated?

**Security:**
- Keine API-Keys geleakt?
- Inputs sanitized?
- Dependencies sicher?

---

## 🎉 Nach dem Merge

### Release Notes

**Contributor werden erwähnt:**

```markdown
## [2.1.0] - 2025-02-01

### Added
- French translation support (thanks @yourname!)
```

### Credits

Alle Contributors werden im README erwähnt:

```markdown
## Contributors

- @contributor1
- @contributor2
- @yourname ✨
```

---

## 💡 Tipps für neue Contributors

### Einfache Einstiege

**Good First Issues:**
- Typos in Dokumentation
- Fehlende Übersetzungen
- Kleine UI-Verbesserungen
- Test Coverage erhöhen

**Label:** `good-first-issue`

### Hilfe bekommen

**Stuck?**
- Issue kommentieren
- Discord/Slack fragen
- Maintainer anpingen
- Dokumentation lesen

**Niemand erwartet Perfektion!** 🚀

---

## 📞 Kontakt

**GitHub Issues:** Für Bugs & Features  
**Discussions:** Für Fragen & Ideen  
**Email:** Für private Anfragen

---

## 📚 Weitere Ressourcen

**Projekt-Docs:**
- [GETTING_STARTED.md](./docs/GETTING_STARTED.md)
- [DEVELOPMENT.md](./docs/DEVELOPMENT.md)
- [FEATURES.md](./docs/FEATURES.md)

**External:**
- [Angular Style Guide](https://angular.dev/style-guide)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Material Design](https://m3.material.io/)

---

**🙏 Danke für deinen Beitrag!**
