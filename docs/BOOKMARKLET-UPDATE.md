# Bookmarklet Update - Vollständige Plugin-Parität

## ✅ Durchgeführte Änderungen (05.11.2024)

### Problem
Das Bookmarklet hatte zwei Hauptprobleme:
1. **Webseiteninfos wurden nicht automatisch ins Textfeld kopiert** (falsches postMessage-Format)
2. **Deutlich weniger Datenextraktion als das Browser-Plugin**

### Lösung

#### 1. PostMessage-Format korrigiert
- **Vorher:** `{action: 'fillFromMeta', text: '...'}`
- **Nachher:** `{type: 'SET_PAGE_DATA', text: '...', pageData: {...}}`
- Canvas Event-Listener erweitert um vollständige `pageData`-Struktur zu verarbeiten

#### 2. Datenextraktion auf Plugin-Niveau erweitert

**Neue Extraktion (vollständige Parität mit Browser-Plugin):**

##### Standard Metadata
- ✅ Meta-Tags: description, keywords, author, language, copyright
- ✅ OpenGraph: title, description, image, type, locale, siteName
- ✅ Twitter Cards: card, title, description, image

##### Bildungs-spezifische Metadata (NEU!)
- ✅ **Dublin Core (DC):** title, creator, subject, description, date, type, format, language, rights
- ✅ **LRMI (Learning Resources):** educationalUse, educationalLevel, learningResourceType, timeRequired

##### Strukturierte Daten
- ✅ JSON-LD (vollständig)
- ✅ Schema.org Microdata

##### Content & Context (NEU!)
- ✅ **License Information:** rel="license" Links, DC.rights, Copyright-Meta, CC-Lizenzen im Text
- ✅ **Breadcrumbs:** Navigation & Hierarchie (wichtig für Fach-Zuordnung!)
- ✅ **Tags & Kategorien:** rel="tag", article:tag Meta, .tags Container
- ✅ **Canonical URL:** Kanonische URL-Referenz
- ✅ **Main Content:** Bis zu 5000 Zeichen aus main/article (vorher nur 1000)

## 📁 Geänderte Dateien

### Bookmarklet
1. **`src/bookmarklet-enhanced.js`** (neu)
   - Lesbare Version mit vollständiger Datenextraktion
   - ~8.5 KB unkomprimiert

2. **`src/bookmarklet-minified.txt`**
   - Minifizierte Version: ~10.9 KB
   - URL-encoded für direktes Copy & Paste

3. **`src/bookmarklet-simple.html`**
   - Aktualisiert mit neuem Code
   - Erweiterte Dokumentation aller Features

### Canvas Komponente
4. **`src/app/components/canvas-view/canvas-view.component.ts`**
   - Erweiterter `SET_PAGE_DATA` Event-Listener
   - Unterstützt vollständige `pageData`-Struktur
   - Speichert alle Daten in `sessionStorage` für Extraction-Enhancement
   - Logging für alle Metadaten-Kategorien

### Build Scripts (neu)
5. **`scripts/minify-bookmarklet.js`**
   - Minifier für Bookmarklet-Code
   - Entfernt Kommentare & Whitespace
   - URL-Encoding

6. **`scripts/update-bookmarklet-html.js`**
   - Aktualisiert HTML automatisch mit minifiziertem Code

## 🔄 Workflow

### Änderungen am Bookmarklet vornehmen:

```bash
# 1. Bearbeite die lesbare Version
# src/bookmarklet-enhanced.js

# 2. Minifiziere
node scripts/minify-bookmarklet.js

# 3. Update HTML
node scripts/update-bookmarklet-html.js

# 4. Testen
# Öffne src/bookmarklet-simple.html im Browser
# Kopiere Code und erstelle Lesezeichen
```

## 📊 Vergleich: Vorher vs. Nachher

### Extrahierte Metadaten-Kategorien

| Kategorie | Vorher | Nachher |
|-----------|--------|---------|
| Standard Meta-Tags | 4 Felder | 6 Felder |
| OpenGraph | 4 Felder | 6 Felder |
| Twitter Cards | ❌ Keine | ✅ 4 Felder |
| Dublin Core | ❌ Keine | ✅ 9 Felder |
| LRMI | ❌ Keine | ✅ 4 Felder |
| JSON-LD | ✅ Ja | ✅ Ja |
| Schema.org | ✅ Ja | ✅ Ja |
| License Info | ❌ Keine | ✅ 4 Quellen |
| Breadcrumbs | ❌ Keine | ✅ Vollständig |
| Tags | ❌ Keine | ✅ 3 Quellen |
| Canonical URL | ❌ Keine | ✅ Ja |
| Main Content | 1000 chars | 5000 chars |

### Code-Größe
- **Vorher:** ~3.8 KB (minifiziert)
- **Nachher:** ~10.9 KB (minifiziert)
- **Grund:** 3x mehr extrahierte Daten

## 🎯 Besonders wichtig für Bildungsressourcen

### Dublin Core (DC)
Standard für Bibliotheken und Archive. Wichtige Felder:
- `DC.creator` → Autor/Ersteller
- `DC.subject` → Fachgebiet/Thema
- `DC.date` → Veröffentlichungsdatum
- `DC.rights` → Lizenz/Rechte

### LRMI (Learning Resource Metadata Initiative)
Standard für Lernressourcen. Wichtige Felder:
- `lrmi:educationalUse` → Verwendungszweck (z.B. "assignment", "self study")
- `lrmi:educationalLevel` → Bildungsstufe (z.B. "Grade 5", "University")
- `lrmi:learningResourceType` → Ressourcentyp (z.B. "lesson plan", "assessment")
- `lrmi:timeRequired` → Bearbeitungszeit

## 🧪 Testing

### Test-Szenarien
1. **Wikipedia-Artikel:** Dublin Core, Canonical URL
2. **YouTube-Video:** OpenGraph, Twitter Cards, Schema.org VideoObject
3. **Bildungsplattform:** LRMI, Dublin Core, License Info
4. **Event-Webseite:** JSON-LD Event, Breadcrumbs
5. **Blog-Artikel:** Tags, article:tag, Breadcrumbs

### Erwartetes Verhalten
- ✅ Textfeld wird sofort mit allen Infos gefüllt
- ✅ Console zeigt "📤 Sent page data to Canvas" mit allen Kategorien
- ✅ Canvas zeigt "📦 Stored complete page data with X categories"
- ✅ sessionStorage enthält `canvas_page_data` mit vollständiger Struktur

## 📝 SessionStorage-Struktur

Nach dem Bookmarklet-Aufruf wird folgendes in sessionStorage gespeichert:

```javascript
{
  "canvas_page_url": "https://example.com",
  "canvas_page_title": "Seitentitel",
  "canvas_page_data": {
    "url": "https://example.com",
    "title": "Seitentitel",
    "meta": {
      "description": "...",
      "keywords": "...",
      "author": "...",
      "language": "de",
      "copyright": "..."
    },
    "openGraph": { ... },
    "twitter": { ... },
    "dublinCore": { ... },
    "lrmi": { ... },
    "structuredData": [ /* JSON-LD */ ],
    "schemaOrg": [ /* Microdata */ ],
    "license": { ... },
    "breadcrumbs": [ ... ],
    "tags": [ ... ],
    "canonical": "...",
    "mainContent": "..."
  }
}
```

Diese Daten können später vom Canvas-Service für verbesserte Metadaten-Extraktion verwendet werden.

## 🚀 Deployment

Die Änderungen sind sofort aktiv, da:
1. Das Bookmarklet-HTML statisch ist (kein Build nötig)
2. Die Canvas-Komponente bereits deployed ist auf Vercel
3. Benutzer nur ihr Lesezeichen aktualisieren müssen

### Für bestehende Benutzer
Entweder:
- **Option A:** Lesezeichen ersetzen (empfohlen für alle neuen Features)
- **Option B:** Weiter altes Bookmarklet nutzen (funktioniert weiterhin, aber weniger Daten)

## 🔗 Kompatibilität

### Backward Compatibility
- ✅ Alte Bookmarklets funktionieren weiterhin (legacy `SET_TEXT` wird unterstützt)
- ✅ Canvas erkennt beide Formate: `pageData` (neu) und `structuredData` (alt)
- ✅ Keine Breaking Changes

### Browser Support
- ✅ Chrome/Edge/Brave (getestet)
- ✅ Firefox (getestet)
- ✅ Safari (sollte funktionieren)
- ❌ IE11 (nicht unterstützt, aber auch nicht relevant)

## 📚 Ressourcen

- [Dublin Core Metadata Element Set](https://www.dublincore.org/specifications/dublin-core/dces/)
- [LRMI Specification](https://www.dublincore.org/specifications/lrmi/)
- [Schema.org](https://schema.org/)
- [OpenGraph Protocol](https://ogp.me/)

---

**Status:** ✅ Vollständig implementiert und getestet
**Datum:** 05.11.2024
**Version:** v2.0 (Plugin-Parität)
