# Installation und Setup - Metadata Agent Webkomponente

## Voraussetzungen

- Node.js (v18 oder höher)
- npm (v9 oder höher)
- OpenAI API Key

## Schritt-für-Schritt Installation

### 1. Dependencies installieren

```bash
cd webkomponente
npm install
```

### 2. Angular CLI installieren (falls nicht vorhanden)

```bash
npm install -g @angular/cli
```

### 3. Schemata prüfen

Stellen Sie sicher, dass der Ordner `schemata/` alle benötigten JSON-Schema-Dateien enthält:

```
schemata/
  ├── core.json
  ├── event.json
  ├── education_offer.json
  ├── learning_material.json
  ├── person.json
  ├── organization.json
  ├── tool_service.json
  ├── occupation.json
  ├── didactic_planning_tools.json
  └── source.json
```

### 4. Entwicklungsserver starten

```bash
npm start
```

Die Anwendung ist unter `http://localhost:4200/` erreichbar.

### 5. OpenAI API Key eingeben

Beim ersten Start werden Sie aufgefordert, Ihren OpenAI API Key einzugeben. Dieser wird benötigt, um die KI-gestützte Metadaten-Extraktion zu nutzen.

## Production Build

### Build erstellen

```bash
npm run build:prod
```

Die optimierten Dateien werden im `dist/`-Verzeichnis gespeichert.

### Build deployen

Die Dateien aus dem `dist/`-Verzeichnis können auf jeden Webserver deployed werden.

## Konfiguration

### API Key Verwaltung

Für Production-Umgebungen sollte der API Key nicht im Frontend gespeichert werden. Stattdessen empfehlen wir:

1. **Backend-Proxy**: Erstellen Sie einen Backend-Endpoint, der die OpenAI-Anfragen proxied
2. **Environment Variables**: Nutzen Sie Angular Environment Files
3. **Secret Management**: Verwenden Sie einen Secret Manager Service

### Anpassung der Schemata

Die Schemata können im `schemata/`-Ordner angepasst werden. Nach Änderungen muss die Anwendung neu gebaut werden.

### Styling anpassen

Die Styles können in folgenden Dateien angepasst werden:

- `src/styles.scss` - Globale Styles
- `src/app/components/metadata-agent/metadata-agent.component.scss` - Komponenten-spezifische Styles

## Integration in bestehende Anwendung

### Als Standalone-Komponente

```typescript
import { MetadataAgentComponent } from './path/to/metadata-agent.component';

// In Ihrem Module
@NgModule({
  imports: [
    // ... andere Imports
  ],
  declarations: [
    MetadataAgentComponent
  ]
})
```

### Als Web Component

Um die Komponente als Custom Element zu exportieren:

1. Installieren Sie `@angular/elements`:
```bash
npm install @angular/elements
```

2. Passen Sie `app.module.ts` an:
```typescript
import { createCustomElement } from '@angular/elements';
import { Injector } from '@angular/core';

export class AppModule {
  constructor(private injector: Injector) {
    const el = createCustomElement(MetadataAgentComponent, { injector });
    customElements.define('metadata-agent', el);
  }
  
  ngDoBootstrap() {}
}
```

3. Verwenden Sie das Element:
```html
<metadata-agent></metadata-agent>
```

## Troubleshooting

### Port bereits in Verwendung

Falls Port 4200 bereits belegt ist:

```bash
ng serve --port 4201
```

### Module not found Fehler

Löschen Sie `node_modules` und installieren Sie neu:

```bash
rm -rf node_modules package-lock.json
npm install
```

### CORS-Fehler bei OpenAI API

OpenAI API erlaubt keine direkten Browser-Anfragen. Sie benötigen einen Backend-Proxy.

### LangGraph.js Fehler

Stellen Sie sicher, dass alle LangChain-Dependencies korrekt installiert sind:

```bash
npm install @langchain/core @langchain/langgraph @langchain/openai
```

## Support

Bei Fragen oder Problemen erstellen Sie bitte ein Issue im Repository.
