# Changelog

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

---

## [2.0.0] - Januar 2025

### 🌐 Internationalisierung (i18n)

**Added:**
- Vollständige Mehrsprachigkeit (Deutsch/Englisch)
- Language Switcher im Header mit Flaggen-UI (🇩🇪 / 🇬🇧)
- Schema-Datenstruktur vollständig lokalisiert (11 Schemas)
- Cross-Language Value Matching für Vokabulare
- AI-Prompts mehrsprachig (Extraktion, Normalisierung, Content-Type Detection)
- Automatische Browser-Spracherkennung
- Persistierung der Sprachauswahl in localStorage

**Services:**
- `I18nService` - UI-Übersetzungen & Sprachwechsel
- `SchemaLocalizerService` - Schema-Daten-Lokalisierung
- `LanguageSwitcherComponent` - Sprach-Auswahl UI

**Files:**
- `src/assets/i18n/de.json` - Deutsche Übersetzungen
- `src/assets/i18n/en.json` - Englische Übersetzungen
- `docs/INTERNATIONALIZATION.md` - App-UI i18n Guide
- `docs/SCHEMA_I18N.md` - Schema-Struktur i18n Guide

---

### 🌳 Verschachtelte Felder & UI

**Added:**
- Baum-Hierarchie für verschachtelte Felder mit Tree-Lines (├─, └─)
- Permanent sichtbare Sub-Fields (keine Akkordeons mehr)
- Geo-Icon Feature (🗺️) - OpenStreetMap Integration für Location-Felder
- Inline-Editing für alle Sub-Fields
- Vertikales Alignment der Input-Felder

**Schemas:**
- `schema:location` (Event, Education Offer)
- `schema:address`, `schema:legalAddress` (Organization, Person)

**Service:**
- `ShapeExpanderService` - Sub-Field Expansion & Rekonstruktion

---

### 🔐 Security & Deployment

**Added:**
- Netlify Secrets Controller Implementation
- Write-only Secrets (API-Keys nie wieder lesbar)
- Automatisches Secret Scanning vor jedem Build
- Build fails on leak (verhindert Deployment bei API-Key-Leaks)

**Changed:**
- API-Keys vollständig server-side (keine Frontend-Injection mehr)
- `apiKey: ''` (leer) in environment.ts/prod.ts
- Netlify Functions lesen Keys aus process.env

**Docs:**
- `QUICKSTART_NETLIFY_SECRETS.md` - 5-Minuten Quick-Start
- `NETLIFY_SECRETS_CONTROLLER.md` - Vollständiger Guide
- `SECURE_API_KEY_ARCHITECTURE.md` - Architektur-Dokumentation

---

### ⚡ Performance & Normalisierung

**Added:**
- Intelligente LLM-Fallback-Optimierung (3-Stufen)
- Lokale Normalisierung für Datum/URL/Boolean (< 1ms)
- Regex-basierte Normalisierung vor LLM-Calls
- Fuzzy-Matching für Vokabulare (Levenshtein Distance)

**Changed:**
- Normalisierung erfolgt nur noch bei Bedarf (nicht immer LLM)
- Deutlich schnellere User-Eingabe-Verarbeitung
- Weniger API-Calls = niedrigere Kosten

---

### 🎨 UI/UX Improvements

**Added:**
- Material Design v3 Theme System
- Custom MD3 Farbpalette (Primary/Secondary/Tertiary)
- Shape System mit konsistenten Rounded Corners
- Elevation (Shadows) für bessere visuelle Hierarchie
- Improved Hover-States & Transitions

**Changed:**
- Input Fields: Border-radius 12px, bessere Touch-Targets
- Chips: Material Design Input Chips mit Hover-Elevation
- Buttons: Filled/Outlined/Success Variants
- Field Groups: Border-radius 16px, Elevation Level 2

---

### 🔧 Platform & Environment

**Added:**
- Auto-Detection für Deployment-Platform (Netlify/Vercel)
- DEPLOYMENT_PLATFORM Environment Variable
- Priority System: ENV Variable > .env > Hardcode
- Verbesserte Platform Detection (Hostname-basiert)

**Changed:**
- Keine separaten Build-Konfigurationen mehr (vercel/netlify)
- Ein Build-Command für alle Plattformen
- Runtime Platform Detection statt Build-Time

**Files:**
- `docs/PLATFORM_DEPLOYMENT.md` - Platform Configuration Guide
- `.env.template` - Template für lokale Entwicklung

---

### 📚 Documentation

**Added:**
- Vollständig überarbeitete Dokumentation (33 Dateien)
- Neue i18n-Dokumentation (3 Dateien)
- `DOCUMENTATION_INDEX.md` - Zentrale Übersicht
- `CHANGELOG.md` - Diese Datei
- Cleanup von 32 veralteten/temporären Docs

**Changed:**
- Klarere Struktur und Kategorisierung
- Konsolidierung redundanter Docs
- Bessere Auffindbarkeit durch Index

---

### 🐛 Bug Fixes

**Fixed:**
- i18n Live-Switching (Sprachwechsel ohne Reload)
- Platform Detection für Vercel
- Field Normalizer Service (Model-Parameter, Label-Qualität)
- Cross-Language Vocabulary Chip Display
- Change Detection bei Schema-Updates

---

## [1.5.0] - Dezember 2024

### Features
- Canvas-basiertes UI für Inline-Editing
- Parallele Feld-Extraktion (6-10s statt 40-50s)
- Multi-Provider Support (OpenAI, B-API OpenAI, B-API AcademicCloud)
- Content-Type-Erkennung (Event, Course, Learning Material, etc.)
- Geocoding-Integration (Photon API)
- Autocomplete & Fuzzy-Matching für Vokabulare

### Integration Modes
- Standalone Mode
- Bookmarklet Mode (Overlay)
- Browser-Plugin Integration

---

## Format

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

### Kategorien:
- `Added` - Neue Features
- `Changed` - Änderungen an existierenden Features
- `Deprecated` - Features die bald entfernt werden
- `Removed` - Entfernte Features
- `Fixed` - Bug Fixes
- `Security` - Sicherheits-Fixes
