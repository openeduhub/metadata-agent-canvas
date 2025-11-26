# Metadata Canvas Viewer Mode

## Übersicht

Der Viewer-Modus ermöglicht es, gespeicherte Metadaten-JSON-Dateien anzuzeigen, ohne die Bearbeitungsfunktionen (Input, Content Type Auswahl, Footer) zu sehen.

## Verwendung

### URL-Parameter

**Viewer-Modus aktivieren:**
```
http://localhost:4200/?mode=viewer
```

**Read-Only Modus (Felder nicht editierbar):**
```
http://localhost:4200/?mode=viewer&readonly=true
```

**Auto-Load JSON-Datei:**
```
http://localhost:4200/?mode=viewer&readonly=true&autoload=metadata_1763413461093.json
```

**Controls (Buttons) steuern:**
```
# Controls explizit anzeigen
?mode=viewer&controls=true

# Controls explizit verstecken
?mode=viewer&controls=false
```

**Kombiniert:**
```
# Read-Only Viewer mit Auto-Load (Controls automatisch versteckt)
?mode=viewer&readonly=true&autoload=meine-datei.json

# Read-Only Viewer mit Auto-Load (Controls explizit anzeigen)
?mode=viewer&readonly=true&autoload=meine-datei.json&controls=true

# Editierbarer Viewer mit Auto-Load (Controls sichtbar)
?mode=viewer&readonly=false&autoload=meine-datei.json

# Editierbarer Viewer ohne Auto-Load, aber ohne Controls
?mode=viewer&readonly=false&controls=false
```

### Verhalten

**Viewer-Modus (`?mode=viewer`):**
- ✅ Zeigt nur das Canvas mit den Metadaten-Feldern
- ❌ Versteckt: Input-Section (Texteingabe, Buttons)
- ❌ Versteckt: Content Type Auswahl
- ❌ Versteckt: Footer (Submit-Buttons)
- ✅ Felder sind editierbar (außer mit `readonly=true`)
- ✅ Chips können entfernt werden
- ✅ Dropdown-Buttons verfügbar

**Read-Only Modus (`?mode=viewer&readonly=true`):**
- ✅ Alle Input-Felder sind disabled
- ❌ Chips können nicht entfernt werden
- ❌ Dropdown-Buttons versteckt
- ✅ Geo-Button (Map) bleibt verfügbar
- ✅ Status-Icons sichtbar

**Controls-Sichtbarkeit (`?controls=true/false`):**
- **Ohne Parameter:** Automatisch (versteckt bei `readonly=true` + `autoload`)
- **`controls=true`:** Floating Controls mit JSON-Loader, Save, Upload, Language Switcher
- **`controls=false`:** Keine Controls, maximale Canvas-Fläche
- **Floating Controls:** Zentriert **unten**, weiße M3 Pill-Form mit Elevation

### JSON-Datei laden

**Manuell:**
1. App mit Viewer-Modus öffnen
2. JSON-Loader Button (in Floating Controls unten) klicken
3. JSON-Datei auswählen

**Automatisch (Query-Parameter `autoload`):**
```
# Standard-Beispiel mit Auto-Load:
/?mode=viewer&readonly=true&autoload=metadata_1763413461093.json

# Andere JSON-Datei aus assets/examples/:
/?mode=viewer&readonly=true&autoload=my-event.json

# Editierbar mit Auto-Load:
/?mode=viewer&readonly=false&autoload=my-event.json
```

**JSON-Dateien austauschen:**
1. JSON-Datei nach `src/assets/examples/` kopieren
2. URL-Parameter `?autoload=filename.json` verwenden
3. Dateien werden automatisch aus `/assets/examples/` geladen

## Beispiel-JSON

Eine vollständige Beispiel-JSON-Datei befindet sich in:
```
src/examples/metadata_1763413461093.json
src/assets/examples/metadata_1763413461093.json
```

Diese enthält ein Event-Metadatenset mit:
- Core-Feldern (Titel, Beschreibung, Keywords, etc.)
- Event-spezifischen Feldern (Datum, Ort, Organisator, etc.)
- Gefüllten und leeren Feldern
- Vokabular-basierten Feldern (Sprache, Status, etc.)

### Mehrere Beispiel-Dateien vorbereiten

**1. JSON-Dateien speichern:**
```bash
# Dateien nach assets/examples/ kopieren
cp my-event-1.json src/assets/examples/
cp my-event-2.json src/assets/examples/
cp my-organization.json src/assets/examples/
```

**2. URLs für verschiedene Beispiele:**
```
# Event 1
canvas-viewer-readonly.html?jsonFile=my-event-1.json

# Event 2
canvas-viewer-readonly.html?jsonFile=my-event-2.json

# Organisation
canvas-viewer-readonly.html?jsonFile=my-organization.json
```

**3. Index-Seite für Auswahl erstellen:**
```html
<h1>Metadata Viewer Beispiele</h1>
<ul>
  <li><a href="canvas-viewer-readonly.html?jsonFile=my-event-1.json">Event 1</a></li>
  <li><a href="canvas-viewer-readonly.html?jsonFile=my-event-2.json">Event 2</a></li>
  <li><a href="canvas-viewer-readonly.html?jsonFile=my-organization.json">Organisation</a></li>
</ul>
```

## Integration

### Als iframe

```html
<iframe
  src="https://your-domain.com/?mode=viewer&readonly=true"
  width="100%"
  height="800"
  frameborder="0"
></iframe>
```

### Programmatisch JSON laden

```javascript
// JSON-Daten an das Viewer-Fenster senden
const viewerWindow = window.open('/?mode=viewer&readonly=true', '_blank');

viewerWindow.addEventListener('DOMContentLoaded', () => {
  const jsonData = { /* your metadata */ };
  const event = new CustomEvent('loadExampleJson', { detail: jsonData });
  viewerWindow.dispatchEvent(event);
});
```

## Technische Details

### Komponenten-Änderungen

**canvas-view.component.ts:**
- Query-Parameter Parsing (`mode`, `readonly`)
- Auto-Load Listener für `loadExampleJson` Event
- Bedingte Template-Rendering

**canvas-field.component.ts:**
- `@Input() readonly` Property
- Disabled-State für alle Input-Felder
- Versteckte Edit-Buttons

**canvas-view.component.html:**
- Bedingte Sections: `*ngIf="!isViewerMode"`
- Readonly-Flag an Felder: `[readonly]="isReadonly"`

### Query-Parameter

Gelesen via `URLSearchParams`:
```typescript
const urlParams = new URLSearchParams(window.location.search);
this.isViewerMode = urlParams.get('mode') === 'viewer';
this.isReadonly = urlParams.get('readonly') === 'true';
```

### Events

**loadExampleJson Event:**
```typescript
window.addEventListener('loadExampleJson', (event: any) => {
  const jsonData = event.detail;
  this.onJsonLoaded({ metadata: jsonData, fileName: 'Example Data' });
});
```

## Use Cases

1. **Metadaten-Prüfung:** Gespeicherte Metadaten ansehen ohne Bearbeitungsmöglichkeit
2. **Dokumentation:** Beispiel-Metadaten in Dokumentation einbetten
3. **Qualitätskontrolle:** Review von Metadaten-Sets vor finaler Freigabe
4. **Archiv:** Historische Metadaten-Versionen anzeigen
5. **API-Debugging:** LLM-Extraktionsergebnisse visualisieren

## Vorteile

- ✅ Reduzierte UI für fokussierte Ansicht
- ✅ Kein versehentliches Bearbeiten im Read-Only Modus
- ✅ Gleiche Rendering-Engine wie Editor
- ✅ Vokabular-Labels werden korrekt lokalisiert
- ✅ Alle Feldtypen unterstützt (Text, Boolean, Date, Array, etc.)
- ✅ Geo-Koordinaten weiterhin auf Karte anzeigbar

## Entwicklung

**Lokaler Test:**
```bash
ng serve
# Browser öffnen:
http://localhost:4200/?mode=viewer&readonly=true
```

**Build mit Beispiel-HTML:**
```bash
ng build
# Die canvas-viewer-readonly.html wird nicht automatisch kopiert
# Manuell kopieren wenn gewünscht:
cp src/canvas-viewer-readonly.html dist/
```

## Zukünftige Erweiterungen

- [ ] URL-Parameter für Auto-Load (`?jsonUrl=https://...`)
- [ ] Print-Stylesheet für Papierausdruck
- [ ] Export als PDF direkt aus Viewer
- [ ] Diff-View für Metadaten-Vergleich
- [ ] Annotations/Comments im Viewer-Modus
