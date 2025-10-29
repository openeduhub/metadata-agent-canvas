# Features Documentation

**Vollständige Feature-Übersicht Metadata Agent Canvas**

---

## 🌐 Internationalisierung (i18n)

**Status:** ✅ Vollständig implementiert (Januar 2025)

### Unterstützte Sprachen

- **Deutsch (DE)** - Standardsprache
- **Englisch (EN)** - Alternative Sprache

### Language Switcher

**Position:** Rechts oben im Header (Flaggen-Symbol 🇩🇪 / 🇬🇧)

**Funktionen:**
- Dropdown mit DE/EN Auswahl
- Persistierung in localStorage (`app_language`)
- Automatische Browser-Erkennung beim ersten Start
- Echtzeit-Umschaltung ohne Page-Reload

### Lokalisierte Bereiche

**UI-Elemente:**
- Header (Mode-Badges, Buttons)
- Input Section (Placeholder, Buttons, Labels)
- Content-Type Dropdown
- Progress Bar
- Field Components (Status, Buttons, Tooltips)
- Footer (Submit-Buttons, Info-Texte)
- Alerts & Dialogs (Success, Error, Confirmation)

**Schema-Daten:**
- Feld-Labels & Beschreibungen
- Gruppen-Labels
- Vokabular-Labels (alle Konzepte)
- Beispiele
- Prompts für AI-Extraktion

**AI-Prompts:**
- Feldextraktion mehrsprachig
- Normalisierung mehrsprachig
- Content-Type Detection mehrsprachig

### Cross-Language Value Matching

**Problem gelöst:** Werte in einer Sprache gespeichert, Sprache gewechselt

**Lösung:** Vokabulare bewahren beide Sprachen:

```typescript
{
  label: "author",         // Aktuelles Label (EN)
  label_de: "Autor/in",    // DE für Matching
  label_en: "author",      // EN für Matching
  uri: "http://..."
}
```

Chips zeigen automatisch das korrekte Label der aktiven Sprache! ✅

**Dokumentation:** [INTERNATIONALIZATION.md](./INTERNATIONALIZATION.md), [SCHEMA_I18N.md](./SCHEMA_I18N.md)

---

## 🎨 Canvas-basiertes UI

**Status:** ✅ Vollständig implementiert

### Konzept

**Alle Felder gleichzeitig sichtbar** - keine Tabs, Akkordeons oder Paginierung.

**Vorteile:**
- Schnelle Übersicht über alle Metadaten
- Inline-Editing für alle Felder
- Echtzeit-Status-Anzeige
- Visuelles Feedback bei Änderungen

### Feld-Hierarchie

**Gruppen:**
- Logische Gruppierung von Feldern
- Visuelle Trennung mit Borders
- Badges mit Feld-Zähler
- Zusammenklappbar (Coming Soon)

**Felder:**
- Status-Icon (✓ ⚪ ⏳ ❌)
- Label (lokalisiert)
- Input (Text, Chips, Dropdown, etc.)
- Info-Button (Beschreibung anzeigen)

**Sub-Fields (verschachtelt):**
- Tree-Lines (├─, └─) zeigen Hierarchie
- Permanent sichtbar
- Inline-Editing
- Vertikales Alignment

### Status-Icons

| Icon | Bedeutung | Farbe |
|------|-----------|-------|
| ✓ | Gefüllt | Grün |
| ⚪ | Leer (optional) | Grau |
| 🔴 | Leer (required) | Rot |
| ⏳ | Wird extrahiert... | Blau |
| ❌ | Fehler | Rot |

**Dokumentation:** [CANVAS_DOCUMENTATION.md](./CANVAS_DOCUMENTATION.md)

---

## 🌳 Verschachtelte Felder

**Status:** ✅ Vollständig implementiert

### Unterstützte Schemas

**Event (`event.json`):**
- `schema:location` (Place, VirtualLocation, PostalAddress)

**Education Offer (`education_offer.json`):**
- `schema:location`

**Organization (`organization.json`):**
- `schema:address`, `schema:legalAddress`

**Person (`person.json`):**
- `schema:address`

### UI-Darstellung

**Baum-Hierarchie mit Tree-Lines:**

```
✓ Ort                      [Steubenstraße 34]      ℹ️ 🗺️
│
├─ ✓ Name                 [Hausparty]
├─ ✓ Street Address       [Steubenstraße 34]
├─ ⚪ Postal Code          [99423]
├─ ✓ Address Locality     [Weimar]
├─ ⚪ Address Region       []
└─ ✓ Address Country      [DE]
```

**Features:**
- Permanent sichtbar (keine Akkordeons)
- Visuell klare Hierarchie
- Inline-Editing für alle Sub-Fields
- Alignment der Input-Felder

### Shape Expander Service

**Service:** `src/app/services/shape-expander.service.ts`

**Funktionen:**
- Lädt `shape` aus Schema-Definition
- Erstellt automatisch Sub-Fields
- Rekonstruiert Objekte für JSON-Export
- Unterstützt mehrere Ebenen (Nested Objects)

**Dokumentation:** [NESTED_FIELDS_STRUCTURE.md](./NESTED_FIELDS_STRUCTURE.md)

---

## 🗺️ Geocoding Integration

**Status:** ✅ Implementiert

### Photon API Integration

**API:** https://photon.komoot.io/

**Features:**
- Automatische Geo-Koordinaten für Adressen
- Click-to-Open auf OpenStreetMap
- Geo-Icon (🗺️) bei Feldern mit Koordinaten

### Geo-Icon Feature

**Wann wird das Symbol angezeigt?**

Bei **Parent-Fields** und **Sub-Fields**, wenn:
1. ✅ Feld hat Sub-Fields (z.B. `schema:location`, `schema:address`)
2. ✅ Sub-Fields enthalten `geo.latitude` UND `geo.longitude`
3. ✅ Optional: Adressdaten vorhanden

**Click-Verhalten:**

Öffnet OpenStreetMap mit genauen Koordinaten:

```
https://www.openstreetmap.org/?mlat=50.9833&mlon=11.3167&zoom=16
```

### Workflow

**1. Extraktion:**
```
Text: "Veranstaltung in Steubenstraße 34, 99423 Weimar"
  ↓
AI extrahiert Adress-Felder
  ↓
streetAddress: "Steubenstraße 34"
postalCode: "99423"
addressLocality: "Weimar"
```

**2. Geocoding (bei JSON-Export):**
```
GeocodeService.enrichWithGeoData(locations)
  ↓
API-Call: POST /geocode
  Body: { query: "Steubenstraße 34, 99423 Weimar" }
  ↓
Response: { lat: 50.9833, lon: 11.3167 }
  ↓
geo.latitude: 50.9833
geo.longitude: 11.3167
```

**3. UI-Feedback:**
```
Geo-Icon (🗺️) erscheint
  ↓
User klickt
  ↓
OpenStreetMap öffnet sich
```

**Dokumentation:** README.md (Geocoding Section)

---

## ⚡ Parallele Feld-Extraktion

**Status:** ✅ Implementiert

### Worker Pool

**Service:** `src/app/services/field-extraction-worker-pool.service.ts`

**Konzept:**
- Bis zu **10 parallele Worker**
- Jeder Worker extrahiert ein Feld
- Ergebnisse werden live gestreamt

### Performance

**Vorher (sequenziell):**
- 12 Felder × 3-4 Sekunden = **40-50 Sekunden**

**Nachher (parallel):**
- 12 Felder ÷ 10 Worker × 3-4 Sekunden = **6-10 Sekunden** ✅

**Verbesserung:** ~80% schneller!

### Live-Updates

**Echtzeit-Streaming:**
```
Field 1: ⏳ Extracting...
Field 2: ⏳ Extracting...
Field 3: ⏳ Extracting...
  ↓ (1 Sekunde später)
Field 1: ✓ "Workshop zum Thema..."
Field 2: ⏳ Extracting...
  ↓ (2 Sekunden später)
Field 2: ✓ "2026-09-15"
Field 3: ✓ "Hochschule für Technik"
```

**User sieht sofort Fortschritt!**

**Dokumentation:** [PERFORMANCE.md](./PERFORMANCE.md)

---

## 🔄 Intelligente Normalisierung

**Status:** ✅ Implementiert

### 3-Stufen-System

**Stufe 1: Lokale Normalisierung (< 1ms)** ⚡

**Datumsformate:**
```
"15.9.2026"   → "2026-09-15"
"15/09/2026"  → "2026-09-15"
"2026-09-15"  → "2026-09-15" (unverändert)
```

**URLs:**
```
"example.com"      → "https://example.com"
"http://test.de"   → "http://test.de" (unverändert)
```

**Boolean:**
```
"ja" / "yes" / "1" → true
"nein" / "no" / "0" → false
```

**Stufe 2: Regex-Normalisierung (< 5ms)**

**Vokabular Fuzzy-Matching:**
```
"Grundscule"  → "Grundschule" (Levenshtein < 3)
"Veranstaltng" → "Veranstaltung"
```

**Stufe 3: LLM-Fallback (2-4 Sekunden)**

Nur wenn lokale Normalisierung fehlschlägt:
```
"zehn"         → 10
"15. Sept 2026" → "2026-09-15"
```

### Vorteile

**Performance:**
- 95% der Normalisierungen: < 5ms
- Nur 5% benötigen LLM
- Weniger API-Calls = niedrigere Kosten

**Dokumentation:** README.md (Normalization Section)

---

## 🎓 Content-Type-Erkennung

**Status:** ✅ Implementiert

### Unterstützte Content-Types

| Type | Schema | Beschreibung |
|------|--------|--------------|
| **Event** | `event.json` | Veranstaltungen, Workshops |
| **Course** | `education_offer.json` | Kurse, Lehrgänge |
| **Learning Material** | `learning_material.json` | Arbeitsblätter, Videos |
| **Didactic Tool** | `didactic_planning_tools.json` | Planungstools |
| **Tool/Service** | `tool_service.json` | Software, Plattformen |
| **Prompt** | `prompt.json` | KI-Prompts |
| **Organization** | `organization.json` | Schulen, Unis |
| **Person** | `person.json` | Personen |
| **Occupation** | `occupation.json` | Berufe |
| **Source** | `source.json` | Quellen |

### Automatische Erkennung

**KI analysiert Text:**
```
Input: "Workshop zum Thema KI, 15.09.2026 in Berlin"
  ↓
AI: "event" (wegen "Workshop", Datum, Ort)
  ↓
Lädt event.json Schema ✅
```

**Manuelle Auswahl:**

User kann Content-Type auch manuell wählen (Dropdown).

---

## 🔌 Integration Modes

**Status:** ✅ Vollständig implementiert

### Standalone Mode

**Direkter Zugriff auf Canvas-URL**

Features:
- Voller Screen
- Alle Features verfügbar
- Header mit Mode-Badge

### Bookmarklet Mode

**Als Overlay auf beliebigen Webseiten**

Features:
- Iframe-Overlay (rechts)
- Extraktion von aktueller Seite
- Close-Button
- postMessage API

### Browser-Plugin Mode

**Integriert in WLO Browser Extension**

Features:
- Sidebar (400px, rechts)
- Integration mit Plugin-Workflow
- Automatische Dublettenprüfung

### Auto-Detection

**Service:** `IntegrationModeService`

**Erkennung:**
```
1. URL-Parameter (?mode=browser-extension)
   ↓ Falls nicht vorhanden ↓
2. Iframe-Check (window !== window.parent)
   ↓ Falls nicht im iframe ↓
3. Hostname-Check (localhost vs. deployed)
```

**Dokumentation:** README.md (Integration Modes)

---

## 🤖 Multi-Provider Support

**Status:** ✅ Implementiert

### Unterstützte Provider

| Provider | Backend | Modell | Kosten |
|----------|---------|--------|--------|
| **B-API OpenAI** | OpenAI via B-API | GPT-4o-mini | Niedrig |
| **B-API AcademicCloud** | DeepSeek via B-API | DeepSeek-R1 | Sehr niedrig |
| **OpenAI Direct** | OpenAI direkt | GPT-4o-mini | Mittel |

### Provider wechseln

**Environment Variable:**

```bash
# .env
LLM_PROVIDER=b-api-openai
```

**Oder in Code:**

```typescript
// src/environments/environment.ts
llmProvider: 'b-api-openai'
```

**Dokumentation:** [LLM_PROVIDER_CONFIGURATION.md](./LLM_PROVIDER_CONFIGURATION.md)

---

## 📋 Schema System

**Status:** ✅ 11 Schemas vollständig i18n-ready

### Schema-Struktur

**Alle Schemas haben:**
- ✅ i18n (DE/EN) für Labels, Beschreibungen, Beispiele
- ✅ Vokabulare (kontrolliert / open)
- ✅ Validierungsregeln
- ✅ Normalisierungsregeln
- ✅ AI-Prompts

**Dokumentation:** [SCHEMA_I18N.md](./SCHEMA_I18N.md)

---

## ✅ Validierung

**Status:** ✅ Implementiert

### Validierungstypen

**Pflichtfelder:**
```json
{
  "required": true
}
```

**Regex-Validierung:**
```json
{
  "validation": {
    "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
  }
}
```

**Vokabular-Validierung:**
```json
{
  "vocabulary": {
    "type": "closed"  // Nur Werte aus Liste
  }
}
```

---

## 📤 Export & Submission

**Status:** ✅ Implementiert

### JSON Export

**Download als JSON-Datei**

Features:
- Vollständige Metadaten
- Geocoding-Anreicherung (falls vorhanden)
- Schema.org konform

### Repository Submission

**Direkt ins Repository speichern**

Features:
- Gast-Submission (ohne Login)
- Collection-Zuordnung
- Workflow-Status setzen
- Dublettenprüfung

**Dokumentation:** README.md (Workflow Section)

---

## 📚 Weitere Features

- **Autocomplete** - Vokabular-Vorschläge während Eingabe
- **Fuzzy-Matching** - Ähnliche Begriffe werden erkannt
- **Drag & Drop** - Chips neu anordnen
- **Copy to Clipboard** - JSON in Zwischenablage
- **Error Handling** - Detaillierte Fehlermeldungen
- **Responsive UI** - Mobile-ready (Tablet+)

---

**🎉 Viel Spaß beim Erkunden aller Features!**
