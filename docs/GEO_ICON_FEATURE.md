# 🗺️ Geo-Symbol Feature - OpenStreetMap Integration

**Status:** ✅ Implementiert  
**Datum:** 19.01.2025

## Übersicht

Das Geo-Symbol Feature zeigt ein klickbares 🗺️-Icon bei Feldern mit Geodaten (Adresse + Koordinaten) an. Bei Klick öffnet sich OpenStreetMap mit der genauen Location.

---

## Funktionsweise

### Wann wird das Geo-Symbol angezeigt?

Das 🗺️-Symbol erscheint automatisch bei **Parent-Fields** und **Sub-Fields**, wenn folgende Bedingungen erfüllt sind:

1. ✅ Das Feld hat Sub-Fields (z.B. `schema:location`, `schema:address`)
2. ✅ Sub-Fields enthalten **geo.latitude** UND **geo.longitude** mit Werten
3. ✅ Optional: Adressdaten (streetAddress, postalCode, addressLocality)

### Betroffene Felder

- **`schema:location`** - Event-Locations (z.B. Veranstaltungsorte)
- **`schema:address`** - Organisationsadressen
- **`schema:legalAddress`** - Rechtliche Adressen

---

## OpenStreetMap URL-Struktur

Die generierte URL folgt diesem Format:

```
https://www.openstreetmap.org/search?
  query=Steubenstraße+34+99423+Weimar
  &zoom=18
  &minlon=11.314260363578796
  &minlat=50.98195523201994
  &maxlon=11.324560046195986
  &maxlat=50.98486633063781
  #map=19/50.978410/11.322656
```

### URL-Parameter

| Parameter | Beschreibung | Beispiel |
|-----------|-------------|----------|
| `query` | Suchanfrage (Adresse oder Koordinaten) | `Steubenstraße 34 99423 Weimar` |
| `zoom` | Initial Zoom-Level | `18` |
| `minlon`, `maxlon` | Bounding Box Längengrad | `11.314...` bis `11.324...` |
| `minlat`, `maxlat` | Bounding Box Breitengrad | `50.981...` bis `50.984...` |
| `#map` | Direkt-Navigation zu Koordinaten | `19/50.978410/11.322656` |

### Bounding Box Berechnung

- **Latitude Delta:** `0.0018` (~200m)
- **Longitude Delta:** `0.0045` (~200m bei 50° Breitengrad)
- **Zoom-Level:** 18 (Straßenansicht), dann 19 (detailliert)

---

## Implementierung

### TypeScript (canvas-field.component.ts)

**Für Parent-Fields:**
```typescript
hasGeoCoordinates(): boolean {
  // Prüft ob geo.latitude und geo.longitude in subFields vorhanden sind
}

getOpenStreetMapUrl(): string | null {
  // Generiert OpenStreetMap URL mit Adresse und Koordinaten
}

openInOpenStreetMap(): void {
  // Öffnet OpenStreetMap in neuem Tab
}
```

**Für Sub-Fields:**
```typescript
subFieldHasGeoCoordinates(subField: CanvasFieldState): boolean {
  // Prüft Sub-Field auf Geodaten
}

openSubFieldInOpenStreetMap(subField: CanvasFieldState): void {
  // Öffnet Sub-Field Location in OpenStreetMap
}
```

### HTML Template

**Parent-Field:**
```html
<button 
  *ngIf="hasGeoCoordinates()" 
  class="geo-button"
  [title]="'Auf OpenStreetMap anzeigen'"
  (click)="openInOpenStreetMap()"
  type="button"
>
  🗺️
</button>
```

**Sub-Field:**
```html
<button 
  *ngIf="subFieldHasGeoCoordinates(subField)" 
  class="geo-button sub-field-geo-button"
  [title]="'Auf OpenStreetMap anzeigen'"
  (click)="openSubFieldInOpenStreetMap(subField)"
  type="button"
>
  🗺️
</button>
```

### CSS Styling

```scss
.geo-button,
.info-button {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  font-size: 18px;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(33, 150, 243, 0.1);
    transform: scale(1.1);
  }
}

.geo-button {
  &:hover {
    background: rgba(76, 175, 80, 0.1); // Grüner Hover-Effekt
  }
}
```

---

## Beispiel-Workflow

### 1. Metadata-Extraktion mit Geocoding

Nach erfolgreicher LLM-Extraktion:

```json
{
  "schema:location": [
    {
      "@type": "Place",
      "name": "Bauhaus-Universität Weimar",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Steubenstraße 34",
        "postalCode": "99423",
        "addressLocality": "Weimar",
        "addressCountry": "Germany"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": 50.978410,
        "longitude": 11.322656
      }
    }
  ]
}
```

### 2. Canvas-Ansicht

**Parent-Field: `schema:location`**
```
✅ Location            [Bauhaus-Universität Weimar]  🗺️  ℹ️
  ├─ ✅ name           Bauhaus-Universität Weimar
  ├─ ✅ address
  │  ├─ ✅ streetAddress    Steubenstraße 34
  │  ├─ ✅ postalCode       99423
  │  ├─ ✅ addressLocality  Weimar
  │  └─ ✅ addressCountry   Germany
  └─ ✅ geo
     ├─ ✅ latitude     50.978410
     └─ ✅ longitude    11.322656
```

### 3. User-Interaktion

1. User klickt auf 🗺️-Symbol
2. Neues Browser-Tab öffnet sich
3. OpenStreetMap zeigt die Location mit Marker
4. Zoom-Level: 19 (sehr detailliert)
5. Bounding Box zeigt ~200m x 200m Bereich

---

## Geocoding-Integration

Das Geo-Symbol funktioniert automatisch mit dem **Geocoding-Service**:

1. **Auto-Geocoding:** Nach Extraktion werden Adressen automatisch geocoded
2. **Photon API:** Konvertiert Adressen zu Koordinaten
3. **Enrichment:** Fügt `geo.latitude` und `geo.longitude` hinzu
4. **Geo-Symbol:** Erscheint automatisch nach erfolgreichem Geocoding

### Geocoding-Flow

```
Adresse extrahiert
    ↓
GeocodingService.geocodeAddress()
    ↓
Photon API Request
    ↓
Koordinaten erhalten
    ↓
geo.latitude + geo.longitude gesetzt
    ↓
🗺️ Geo-Symbol erscheint
```

---

## User Benefits

- ✅ **Sofortige Visualisierung:** Location direkt auf Karte sehen
- ✅ **Qualitätskontrolle:** Prüfen ob Geocoding korrekt war
- ✅ **Kontextverständnis:** Geografische Lage verstehen
- ✅ **Keine manuelle Suche:** Direkt-Link zu exakter Position
- ✅ **Verifizierung:** Adresse mit Karte abgleichen

---

## Technische Details

### Browser-Kompatibilität

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile Browser (iOS, Android)

### Performance

- ⚡ **Icon-Rendering:** Instant (native Emoji)
- ⚡ **URL-Generierung:** < 1ms
- ⚡ **Kein API-Call:** Nur URL-Opening, kein Fetch

### Sicherheit

- ✅ **HTTPS:** OpenStreetMap wird per HTTPS geöffnet
- ✅ **`_blank` Target:** Öffnet in neuem Tab, kein `window.opener`
- ✅ **Keine API-Keys:** OpenStreetMap ist frei zugänglich

---

## Zukünftige Erweiterungen

### Mögliche Features

1. **Marker-Customization:** Eigene Marker-Icons für verschiedene Location-Typen
2. **Multi-Location View:** Mehrere Locations auf einer Karte anzeigen
3. **Alternative Karten-Anbieter:** Google Maps, Bing Maps als Option
4. **Inline-Vorschau:** Kleine Karten-Vorschau direkt im Canvas
5. **Geocoding-Status:** Visuelles Feedback während Geocoding-Prozess

---

## Changelog

### v1.0.0 - 19.01.2025

- ✅ Geo-Symbol für Parent-Fields mit Geodaten
- ✅ Geo-Symbol für Sub-Fields mit Geodaten
- ✅ OpenStreetMap URL-Generierung mit Bounding Box
- ✅ Adress-basierte Suchanfrage
- ✅ Koordinaten-basierte Fallback-Suche
- ✅ Hover-Effekte und Styling
- ✅ Tooltip: "Auf OpenStreetMap anzeigen"

---

**Entwickelt für:** Metadata-Agent Canvas Webkomponente  
**Integration:** Automatic (kein Setup erforderlich)  
**Dependencies:** Keine (nutzt natives `window.open()`)
