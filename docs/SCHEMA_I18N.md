# Schema i18n Structure

**Status:** ✅ Vollständig implementiert (Januar 2025)

## Übersicht

Alle Schemata in `src/schemata/` unterstützen jetzt **vollständige Internationalisierung (i18n)** mit Deutsch (DE) und Englisch (EN). Diese Struktur ermöglicht automatischen Sprachwechsel ohne Code-Änderungen.

---

## Schema-i18n-Struktur

### 1. Basis-Feld mit i18n

**Alte Struktur (deprecated):**
```json
{
  "id": "cclom:title",
  "group": "description",
  "label": "Titel",
  "description": "Aussagekräftiger Titel der Ressource."
}
```

**✅ Neue i18n-Struktur:**
```json
{
  "id": "cclom:title",
  "group": "description",
  "label": {
    "de": "Titel",
    "en": "Title"
  },
  "description": {
    "de": "Aussagekräftiger, eigenständiger Titel der Ressource.",
    "en": "Concise, self-contained title of the resource."
  },
  "examples": {
    "de": ["Zukunft der Hochschullehre"],
    "en": ["Future of Higher Education"]
  },
  "prompt": {
    "de": "Extrahiere den Titel der Ressource",
    "en": "Extract the resource title"
  }
}
```

### 2. Gruppen-Labels

**Alte Struktur:**
```json
{
  "groups": [
    {
      "id": "description",
      "label": "Beschreibung"
    }
  ]
}
```

**✅ Neue Struktur:**
```json
{
  "groups": [
    {
      "id": "description",
      "label": {
        "de": "Beschreibung",
        "en": "Description"
      }
    }
  ]
}
```

### 3. Vokabulare mit i18n

**Vollständige i18n-Unterstützung für Konzepte:**

```json
{
  "id": "ccm:educationalcontext",
  "label": {
    "de": "Bildungsstufe",
    "en": "Education Level"
  },
  "description": {
    "de": "Bildungsstufe, in der die Ressource genutzt werden kann.",
    "en": "Education stage where the resource can be used."
  },
  "system": {
    "vocabulary": {
      "type": "skos",
      "scheme": "http://w3id.org/openeduhub/vocabs/educationalContext/",
      "concepts": [
        {
          "label": {
            "de": "Elementarbereich",
            "en": "elementary level"
          },
          "uri": "http://w3id.org/openeduhub/vocabs/educationalContext/elementarbereich",
          "description": {
            "de": "Frühkindliche Bildung",
            "en": "Early childhood education"
          },
          "altLabels": {
            "de": ["Kindergarten", "Vorschule"],
            "en": ["kindergarten", "preschool"]
          }
        }
      ]
    }
  }
}
```

---

## Technische Implementierung

### SchemaLocalizerService

Der `SchemaLocalizerService` bietet zentrale Lokalisierungsmethoden:

#### 1. localizeString(value, language)

```typescript
// Input: {de: "Titel", en: "Title"}
localizeString(field.label, 'de') // → "Titel"
localizeString(field.label, 'en') // → "Title"
```

**Fallback-Kette:** language → de → en → originalwert

#### 2. localizeVocabulary(vocabulary, language)

```typescript
const localized = localizeVocabulary(vocab, 'en');
// Ergebnis:
{
  type: "closed",
  concepts: [
    {
      label: "author",         // ← Aktuelles Label (EN)
      label_de: "Autor/in",    // ← DE bewahrt
      label_en: "author",      // ← EN bewahrt
      uri: "http://..."
    }
  ]
}
```

#### 3. localizeField(field, language)

Lokalisiert ein komplettes Feld inkl. Labels, Beschreibungen, Beispiele und Vokabulare.

### Automatischer Sprachwechsel

**Workflow:**

```
User klickt Language Switcher (DE → EN)
  ↓
I18nService.setLanguage('en')
  ↓
Observable emitted
  ↓
CanvasService.relocalizeAllFields('en')
  ↓
Für jedes Feld:
  - localizeField(fieldDef, 'en')
  - Neue Objekte mit EN-Labels
  ↓
State-Update
  ↓
UI zeigt englische Labels ✅
```

---

## Cross-Language Value Matching

### Problem

Gespeicherter Wert: `"Autor/in"` (DE)  
Nach Sprachwechsel: Vokabular-Label = `"author"` (EN)

Wie wird der Chip korrekt angezeigt?

### Lösung: label_de und label_en Properties

```typescript
interface VocabularyConcept {
  label: string;       // Aktuelles lokalisiertes Label
  label_de: string;    // Deutsche Version (für Matching)
  label_en: string;    // Englische Version (für Matching)
  uri: string;
}
```

**getVocabularyLabel() Matching:**

```typescript
getVocabularyLabel(value: "Autor/in"): string {
  const concept = vocabulary.concepts.find(c => 
    c.label === value ||        // Aktuelles Label
    c.label_de === value ||     // DE-Label ✅
    c.label_en === value ||     // EN-Label
    c.uri === value             // URI
  );
  return concept?.label;        // → "author" (EN)
}
```

---

## Verfügbare Schemas

**Vollständig i18n-ready:**

| Schema | Felder | Vokabulare | Status |
|--------|--------|------------|--------|
| `core.json` | 12 | 3 | ✅ |
| `event.json` | 35 | 1 | ✅ |
| `education_offer.json` | 23 | - | ✅ |
| `didactic_planning_tools.json` | 38 | 5 | ✅ |
| `learning_material.json` | 21 | - | ✅ |
| `source.json` | 16 | - | ✅ |
| `prompt.json` | 15 | 3 | ✅ |
| `tool_service.json` | 17 | 2 | ✅ |
| `organization.json` | 19 | 1 | ✅ |
| `person.json` | 13 | - | ✅ |
| `occupation.json` | 13 | - | ✅ |

---

## Best Practices

### 1. Neue Felder anlegen

```json
{
  "id": "new:field",
  "label": {
    "de": "Deutsches Label",
    "en": "English Label"
  },
  "description": {
    "de": "Deutsche Beschreibung",
    "en": "English description"
  }
}
```

### 2. Vokabular-Labels

**Wichtig:** Nutze **exakte Schreibweise** inkl. Multi-Word-Labels und Klammern!

```json
{
  "label": {
    "de": "Hackathon (Wettbewerb)",
    "en": "Hackathon (Competition)"
  }
}
```

### 3. Descriptions in AI-Prompts

Füge sprachspezifische Hinweise für die KI hinzu:

```json
{
  "description": {
    "de": "Bildungsstufe, in der die Ressource genutzt werden kann. Nutze ausschließlich die Vokabular-Labels in exakt gleicher Schreibweise, einschließlich Mehrwort-Bezeichnungen oder Klammern.",
    "en": "Education stage where the resource can be used. Use the vocabulary labels exactly as listed, including multi-word labels and parentheses."
  }
}
```

---

## Migration & Validierung

### Validierungs-Scripts

**1. Vollständigkeit prüfen:**

```bash
node scripts/validate-translations.js
```

**2. Alle Schemas validieren:**

```bash
node scripts/validate-all-schemas.js
```

**Erwartete Ausgabe:**

```
✅ All schemas have valid i18n structure
✅ All vocabulary concepts have de and en labels
✅ All group labels are translated
```

---

## Siehe auch

- **[INTERNATIONALIZATION.md](./INTERNATIONALIZATION.md)** - App-seitige i18n (UI, Komponenten)
- **[NESTED_FIELDS_STRUCTURE.md](./NESTED_FIELDS_STRUCTURE.md)** - Verschachtelte Felder
- **Beispiel:** `src/schemata/core.json` - Vollständig i18n-migriertes Schema
