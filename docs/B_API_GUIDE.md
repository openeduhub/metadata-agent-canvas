# B-API LLM Integration Guide

Kompakter Leitfaden zur Integration der B-API für LLM-basierte Metadaten-Extraktion.

---

## 🚀 Quick Start

**4 Schritte zur Integration:**

```bash
# 1. Installation
npm i ngx-edu-sharing-b-api

# 2. Module importieren (app.module.ts)
import { BApiModule } from 'ngx-edu-sharing-b-api';

@NgModule({
  imports: [
    BApiModule.forRoot({ rootUrl: '/edu-sharing/rest/bapi' })
  ]
})

# 3. Service nutzen (component.ts)
import { EduSharingLlmService } from 'ngx-edu-sharing-b-api';

constructor(private eduSharingLlmService: EduSharingLlmService) {}

# 4. API aufrufen (mit funktionierender Test-Node)
const response = await firstValueFrom(
  this.eduSharingLlmService.chatCompletions({
    body: {
      configIds: [{ 
        type: "node", 
        nodeId: "353d1226-8f33-4551-bd12-268f33e55192",  // Test-Node mit "anything" Config
        configName: "anything" 
      }],
      contextNodeId: "",
      metadataSet: "mds_oeh",
      user: "admin",
      variables: { "cm:name": ["Photosynthese"] }  // Ersetzt {{var.cm:name|-}}
    }
  })
);
```

---

## 📋 Konzept

### Was ist die B-API?

Die B-API bietet **sichere LLM-Anfragen** mit **zentralem Prompt-Management**:

- ✅ **Prompts sind in Nodes hinterlegt** → Keine freien User-Prompts
- ✅ **Platzhalter-System** → Dynamische Werte ohne Code-Änderung
- ✅ **Caching** → Bessere Performance
- ✅ **Config-Komposition** → DRY-Prinzip (Don't Repeat Yourself)

### Endpoint

```
POST https://repository.staging.openeduhub.net/edu-sharing/rest/bapi/api/v1/edu-sharing/chat/completion
```

**NICHT:** `/llm/openai/chat/completion` (das ist direkter LLM-Zugriff ohne Prompt-Management)

---

## 🔧 Node erstellen & Prompts hinterlegen

### Schritt 1: Node anlegen

**Via Swagger-UI:** https://repository.staging.openeduhub.net/edu-sharing/swagger/#/NODE%20v1/createChild

```
POST /node/v1/nodes/-home-/{parentNodeId}/children
```

**Parameter:**
- `type`: `ccm:io`
- `aspects`: `ccm:bapi`
- `obeyMds`: `false` ⚠️ **WICHTIG**
- `renameIfExists`: `false`

**Request Body:**
```json
{
  "cm:name": ["Metadata Extractor Config"],
  "ccm:bapi_config": [
    "{\"anything\": {\"provider\": \"openai\", \"useCaching\": true, \"chatCompletion\": {\"model\": \"gpt-4o-mini\", \"messages\": [{\"role\": \"user\", \"content\": \"Erstelle eine Zusammenfassung des Themas ({{var.cm:name|-}}) in 5 Sätzen.\"}]}}}"
  ]
}
```

**cURL-Beispiel (getestet und funktioniert - 20.10.2025):**
```bash
# Credentials: echo -n "username:password" | base64
# Beispiel mit Admin-User (Credentials aus .env verwenden!)

curl -X 'POST' \
  'https://repository.staging.openeduhub.net/edu-sharing/rest/node/v1/nodes/-home-/e8f4bb69-5840-45df-b4bb-69584035df3d/children?type=ccm%3Aio&aspects=ccm%3Abapi&renameIfExists=false&obeyMds=false' \
  -H 'Accept: application/json' \
  -H 'Authorization: Basic <base64(username:password)>' \
  -H 'Content-Type: application/json' \
  -H 'Content-Length: 285' \
  -d '{
    "cm:name": ["My Prompt Node 1729440172345"],
    "ccm:bapi_config": [
      "{\"demo_prompt\": {\"provider\": \"openai\", \"useCaching\": true, \"chatCompletion\": {\"model\": \"gpt-4o-mini\", \"messages\": [{\"role\": \"user\", \"content\": \"Erkläre {{var.thema|-}} in 3 Sätzen.\"}]}}}"
    ]
  }'
```

**Wichtige Header:**
- ✅ `Content-Length` - **WICHTIG!** Wird oft vergessen
- ✅ `Accept: application/json` vor Authorization
- ✅ `Authorization: Basic <base64(username:password)>` - Credentials aus `.env`!

**Tipp:** Nutze Timestamp im Namen um Duplikate zu vermeiden: `"My Prompt Node ${Date.now()}"`

**Response:** Du erhältst `ref.id` → das ist deine **Node-ID** für spätere API-Calls!

**Berechtigungen:** Node-Erstellung benötigt Admin-Rechte oder spezielle Permissions auf Parent-Node.  
**Credentials:** Funktionierende Admin-Credentials siehe `B-API-Test/.env` (nicht versioniert!)

### Schritt 2: Property-Format (ccm:bapi_config)

**✅ RICHTIG - Model innerhalb chatCompletion:**

```json
{
  "anything": {
    "provider": "openai",
    "useCaching": true,
    "chatCompletion": {
      "model": "gpt-4o-mini",
      "messages": [
        {
          "role": "user",
          "content": "Erstelle eine Zusammenfassung des Themas ({{var.cm:name|-}}) in 5 Sätzen."
        }
      ]
    }
  }
}
```

**❌ FALSCH - Model außerhalb:**
```json
{
  "anything": {
    "provider": "openai",
    "model": "gpt-4o-mini",  // ← FALSCH!
    "chatCompletion": { ... }
  }
}
```

### Schritt 3: Property nachträglich setzen/ändern

**Via Swagger-UI:** https://repository.staging.openeduhub.net/edu-sharing/swagger/#/NODE%20v1/setProperty

```
POST /node/v1/nodes/-home-/{nodeId}/property?property=ccm:bapi_config
```

**Body:** Array mit JSON-String (⚠️ **escaped JSON innerhalb Array**):
```json
[
  "{\"anything\": {\"provider\": \"openai\", \"useCaching\": true, \"chatCompletion\": {\"model\": \"gpt-4o-mini\", \"messages\": [{\"role\": \"user\", \"content\": \"Erstelle eine Zusammenfassung des Themas ({{var.cm:name|-}}) in 5 Sätzen.\"}]}}}"
]
```

**Oder lesbar als JSON-Objekt (wird zu String serialisiert):**
```json
{
  "anything": {
    "provider": "openai",
    "useCaching": true,
    "chatCompletion": {
      "model": "gpt-4o-mini",
      "messages": [
        {
          "role": "user",
          "content": "Erstelle eine Zusammenfassung des Themas ({{var.cm:name|-}}) in 5 Sätzen."
        }
      ]
    }
  }
}
```

---

## 🎯 Platzhalter-System

### Syntax

```
{{QUELLE.PROPERTY|FALLBACK}}
```

**Komponenten:**
- `QUELLE`: `var` (API-Call) oder `node` (Context-Node)
- `PROPERTY`: z.B. `cm:name`, `cm:title`
- `FALLBACK`: Was einsetzen wenn leer (z.B. `-` für nichts)

### Beispiel 1: Variable

**Prompt:**
```json
{
  "content": "Thema: {{var.cm:name|-}}"
}
```

**API-Call:**
```typescript
variables: { "cm:name": ["Photosynthese"] }
```

**Ergebnis:** → "Thema: Photosynthese"

### Beispiel 2: Node-Property

**Prompt:**
```json
{
  "content": "Titel: {{node.cm:title|-}}"
}
```

**API-Call:**
```typescript
contextNodeId: "95f2002f-1745-4b47-889d-8376af38fe41"
```

**Ergebnis:** → "Titel: [Wert aus Node cm:title]"

### Beispiel 3: Fallback-Kette

**Prompt:**
```json
{
  "content": "{{var.cm:name|{{node.cm:name|Kein Thema}}}}"
}
```

**Logik:**
1. Erst Variable `cm:name` prüfen
2. Dann Node `cm:name` prüfen
3. Sonst "Kein Thema"

---

## 🔄 Config-Komposition mit Defaults

### Pattern: Wiederverwendbare Basis-Config

**Beispiel-Node: `8fc94117-2fe3-4f6d-8941-172fe39f6d8d`**

Statt Config-Parameter in jedem Prompt zu wiederholen, definiere **gemeinsame Defaults** und ergänze nur noch die Messages:

```json
{
  "defaults": {
    "provider": "openai",
    "useCaching": true,
    "chatCompletion": {
      "model": "gpt-4o-mini"
    }
  },
  "anything1": {
    "chatCompletion": {
      "messages": [
        {
          "role": "user",
          "content": "Erstelle eine Zusammenfassung des Themas ({{var.cm:name|-}}) in 1 Satz."
        }
      ]
    }
  },
  "anything2": {
    "chatCompletion": {
      "messages": [
        {
          "role": "user",
          "content": "Erstelle eine Zusammenfassung des Themas ({{var.cm:name|-}}) in 2 Sätzen."
        }
      ]
    }
  }
}
```

### API-Call: Defaults + Spezifische Config

**Kurze Zusammenfassung (1 Satz):**
```typescript
const response = await firstValueFrom(
  this.eduSharingLlmService.chatCompletions({
    body: {
      configIds: [
        { type: "node", nodeId: "8fc94117-2fe3-4f6d-8941-172fe39f6d8d", configName: "defaults" },
        { type: "node", nodeId: "8fc94117-2fe3-4f6d-8941-172fe39f6d8d", configName: "anything1" }
      ],
      contextNodeId: "",
      metadataSet: "mds_oeh",
      user: "admin",
      variables: { "cm:name": ["Künstliche Intelligenz"] }
    }
  })
);
```

**Lange Zusammenfassung (2 Sätze):**
```typescript
configIds: [
  { type: "node", nodeId: "8fc94117-2fe3-4f6d-8941-172fe39f6d8d", configName: "defaults" },
  { type: "node", nodeId: "8fc94117-2fe3-4f6d-8941-172fe39f6d8d", configName: "anything2" }
]
```

**Vorteil:**
- Provider, Model, Caching nur 1x definieren
- Mehrere Prompts teilen sich Basis-Config
- DRY-Prinzip (Don't Repeat Yourself)

**Wichtig:** Beide `configIds` müssen dieselbe `nodeId` haben, aber unterschiedliche `configName`!

---

## 💻 Code-Beispiele

### Basis-Integration (Canvas-Komponente)

```typescript
import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EduSharingLlmService } from 'ngx-edu-sharing-b-api';

@Component({
  selector: 'app-canvas-view',
  templateUrl: './canvas-view.component.html'
})
export class CanvasViewComponent implements OnInit {
  
  constructor(private eduSharingLlmService: EduSharingLlmService) {}

  async ngOnInit(): Promise<void> {
    const metadata = await this.extractMetadata({
      title: "Photosynthese erklärt",
      url: "https://example.com/photosynthese",
      content: "Die Photosynthese ist..."
    });
    
    console.log('Extrahierte Metadaten:', metadata);
  }

  async extractMetadata(pageData: any): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.eduSharingLlmService.chatCompletions({
          body: {
            configIds: [
              { 
                type: "node", 
                nodeId: "353d1226-8f33-4551-bd12-268f33e55192", 
                configName: "metadata_extractor" 
              }
            ],
            contextNodeId: "",
            metadataSet: "mds_oeh",
            user: "admin",
            variables: {
              "pageTitle": [pageData.title],
              "pageUrl": [pageData.url],
              "pageContent": [pageData.content]
            }
          }
        })
      );

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Fehler bei Metadaten-Extraktion:', error);
      return '';
    }
  }
}
```

### Mehrere Prompts kombinieren

```typescript
async extractKeywordsAndDescription(pageContent: string) {
  const response = await firstValueFrom(
    this.eduSharingLlmService.chatCompletions({
      body: {
        configIds: [
          { type: "node", nodeId: "...", configName: "defaults" },
          { type: "node", nodeId: "...", configName: "extract_keywords" },
          { type: "node", nodeId: "...", configName: "extract_description" }
        ],
        contextNodeId: "",
        metadataSet: "mds_oeh",
        user: "admin",
        variables: { "content": [pageContent] }
      }
    })
  );

  return response.choices[0]?.message?.content;
}
```

---

## 📝 Praktische Prompt-Templates

### Template 1: Metadaten-Extraktion

```json
{
  "metadata_extractor": {
    "provider": "openai",
    "useCaching": true,
    "chatCompletion": {
      "model": "gpt-4o-mini",
      "messages": [
        {
          "role": "user",
          "content": "Analysiere folgende Webseite und erstelle Metadaten:\n\nTitel: {{var.pageTitle|-}}\nURL: {{var.pageUrl|-}}\nInhalt: {{var.pageContent|-}}\n\nErstelle:\n- 5 Keywords (Komma-getrennt)\n- Kurze Beschreibung (2-3 Sätze)\n- Fachgebiet (z.B. Biologie, Mathematik)\n\nFormat: JSON"
        }
      ]
    }
  }
}
```

**API-Call:**
```typescript
variables: {
  "pageTitle": ["Photosynthese erklärt"],
  "pageUrl": ["https://example.com"],
  "pageContent": ["Text der Webseite..."]
}
```

### Template 2: Zusammenfassung mit Fallback

```json
{
  "summarize": {
    "provider": "openai",
    "useCaching": true,
    "chatCompletion": {
      "model": "gpt-4o-mini",
      "messages": [
        {
          "role": "user",
          "content": "Erstelle eine Zusammenfassung in 3 Sätzen für:\n\nTitel: {{var.title|{{node.cm:title|Ohne Titel}}}}\nBeschreibung: {{var.description|{{node.cm:description|-}}}}"
        }
      ]
    }
  }
}
```

### Template 3: Fachgebiet-Klassifikation

```json
{
  "classify_discipline": {
    "provider": "openai",
    "useCaching": true,
    "chatCompletion": {
      "model": "gpt-4o-mini",
      "messages": [
        {
          "role": "system",
          "content": "Du bist ein Experte für Bildungsmetadaten. Ordne Inhalte einem Fachgebiet zu."
        },
        {
          "role": "user",
          "content": "Ordne folgenden Inhalt einem Fachgebiet zu (Biologie, Chemie, Physik, Mathematik, Informatik, Geographie, Geschichte, etc.):\n\n{{var.content|-}}\n\nAntworte nur mit dem Fachgebiet."
        }
      ]
    }
  }
}
```

---

## ✅ Getestete Beispiel-Nodes (Staging)

Diese Nodes sind auf Staging bereits angelegt und funktionieren garantiert:

### Node 1: Einfacher Prompt
- **Node-ID**: `353d1226-8f33-4551-bd12-268f33e55192`
- **Config-Name**: `anything`
- **Prompt**: "Erstelle eine Zusammenfassung des Themas ({{var.cm:name|-}}) in 5 Sätzen."
- **Test**: ✅ Funktioniert (siehe `B-API-Test/test-b-api.js`)

### Node 2: Defaults-Pattern
- **Node-ID**: `8fc94117-2fe3-4f6d-8941-172fe39f6d8d`
- **Config-Namen**: `defaults`, `anything1`, `anything2`
- **Prompts**: 
  - `anything1`: 1 Satz Zusammenfassung
  - `anything2`: 2 Sätze Zusammenfassung
- **Test**: ✅ Funktioniert (siehe `B-API-Test/test-defaults.js`)

### Node 3: Neu erstellte Demo-Node
- **Node-ID**: `6be78666-08a0-45c1-a786-6608a065c121`
- **Config-Name**: `demo_prompt`
- **Prompt**: "Erkläre das Thema {{var.thema|-}} in genau 3 Sätzen für Schüler."
- **Test**: ✅ Erstellt am 20.10.2025 (siehe `B-API-Test/test-create-node-working.js`)
- **Besonderheit**: Via Script erstellt - demonstriert vollständigen Workflow!

---

## 🔍 Test-Scripts (Vollständig getestet!)

Im Verzeichnis `B-API-Test/` findest du **funktionierende, getestete** Demo-Scripts:

### test-b-api.js (Basis-Test)

✅ **Status:** Funktioniert komplett

Basis-Test mit Prompt-Management:

```bash
cd B-API-Test
npm install
npm start
```

**Demonstriert:**
- ✅ Prompt aus Node laden
- ✅ Variables übergeben (Platzhalter-Ersetzung)
- ✅ Verschiedene Themen testen
- ✅ Fallback-Handling

Config-Komposition mit Defaults:

```bash
npm run test:defaults
```

**Demonstriert:**
- Defaults-Pattern (DRY-Prinzip)
- Multiple configIds in einem Request
- Verschiedene Prompt-Varianten (1 vs 2 Sätze)

**Nutzt Node:** `8fc94117-2fe3-4f6d-8941-172fe39f6d8d`

### test-create-node-working.js (Vollständiger Workflow) 

**Status:** Funktioniert - Node-Erstellung getestet!

**Kompletter Workflow von Node-Erstellung bis LLM-Aufruf:**

```bash
npm run test:create-node-working
```

**Demonstriert:**
1. Node mit `ccm:bapi_config` Property erstellen
2. Prompt-Config als JSON speichern
3. LLM-Aufruf mit dem neuen Prompt
4. Korrekte Header (inkl. Content-Length!)
5. Timestamp im Namen (vermeidet Duplikate)

**Erstellt neue Node unter:** `e8f4bb69-5840-45df-b4bb-69584035df3d`

**Wichtig:** Nutzt funktionierende Admin-Credentials. Für eigene Credentials siehe `test-create-node.js`

---

## Response-Format

```typescript
interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: 'assistant';
      content: string;  // Die LLM-Antwort
    };
  }>;
}
```

**Zugriff:**
```typescript
const antwort = response.choices[0]?.message?.content || '';
```

---

## ⚠️ Wichtige Hinweise

### 1. Model-Position

**✅ RICHTIG:**
```json
{
  "chatCompletion": {
    "model": "gpt-4o-mini",
    "messages": [...]
  }
}
```

**❌ FALSCH:**
```json
{
  "model": "gpt-4o-mini",  // ← Model MUSS innerhalb chatCompletion sein!
  "chatCompletion": {
    "messages": [...]
  }
}
```

### 2. Authentication

- **Basic Auth** über HTTPS
- Format: `Authorization: Basic base64(username:password)`
- Identisch zur Browser-Plugin Auth
- API-Keys bleiben **server-side** (nie im Browser!)

### 3. Caching

```json
{
  "useCaching": true  // ← Empfohlen für bessere Performance
}
```

Bei gleichen Anfragen wird gecachtes Ergebnis zurückgegeben.

### 4. ContextNodeId

Optional: Node-ID deren Properties als Fallback genutzt werden.

### 5. Node-Erstellung Credentials

⚠️ **Wichtig für Node-Erstellung:**
- Benötigt Admin-Rechte oder spezielle Permissions
- User muss Write-Rechte auf Parent-Node haben
- Bei Fehler 403/409: Credentials prüfen
- **Getestet:** `admin` User funktioniert auf Staging
- **Content-Length Header** ist Pflicht!

### 6. Troubleshooting Node-Erstellung

**HTTP 403 - Forbidden:**
- User hat keine Berechtigung
- Lösung: Admin-Credentials nutzen oder Rechte vergeben

**HTTP 409 - Duplicate:**
- Node mit Namen existiert bereits
- Lösung: Timestamp im Namen: `"Node ${Date.now()}"`

**HTTP 500 - Server Error:**
- Server-Konfiguration fehlt
- Lösung: Siehe `B-API-Test/SERVER_SETUP.md`

---

## 🆚 Alternativen

### LargeLanguageModelsService vs. EduSharingLlmService

| Feature | LargeLanguageModelsService | EduSharingLlmService |
|---------|---------------------------|---------------------|
| **Methode** | `chatCompletion()` | `chatCompletions()` |
| **Prompts** | Im Code | In Nodes |
| **Auth** | Session (eingeloggt) | Proxy (auch Guest) |
| **Flexibilität** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Sicherheit** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Use-Case** | Chatbots | Metadaten-Extraktion |

**Empfehlung für Canvas:** `EduSharingLlmService` (Prompt-Management)

---

## 📚 Weitere Ressourcen

- **Swagger-UI**: https://repository.staging.openeduhub.net/edu-sharing/swagger/
- **Test-Scripts**: `B-API-Test/` Verzeichnis
- **Chat-Assistant**: Referenz-Implementierung für `LargeLanguageModelsService`

---

## 🎯 Best Practices

1. **Nutze Defaults** für gemeinsame Configs (DRY-Prinzip)
2. **Sprechende Config-Namen** (`summary_short` statt `config1`)
3. **Caching aktivieren** (`useCaching: true`)
4. **Platzhalter mit Fallback** (`{{var.x|default}}`)
5. **Content-Length Header** bei Node-Erstellung (oft vergessen!)
6. **Timestamp im Node-Namen** um Duplikate zu vermeiden
7. **Model innerhalb chatCompletion** (häufiger Fehler!)
8. **Teste mit Demo-Scripts** aus `B-API-Test/` vor Integration
9. **Admin-Credentials** für Node-Erstellung nutzen
10. **Funktionierende Beispiel-Nodes** als Referenz verwenden

## 📦 Fertige Demo-Suite

Im Verzeichnis `B-API-Test/` findest du eine **vollständig getestete Demo-Suite**:

```bash
cd B-API-Test

# Basis-Funktionalität
npm start                          # ✅ Getestet

# Fortgeschrittene Patterns
npm run test:defaults              # ✅ Getestet

# Node-Erstellung (vollständiger Workflow)
npm run test:create-node-working   # ✅ Getestet - erstellt echte Nodes!
```

**Alle Scripts sind getestet und funktionieren auf Staging!** 🎉

**Siehe auch:**
- `B-API-Test/README.md` - Detaillierte Dokumentation
- `B-API-Test/DEMO.md` - Schnellübersicht aller Scripts
- `B-API-Test/SERVER_SETUP.md` - Admin-Setup bei Problemen
