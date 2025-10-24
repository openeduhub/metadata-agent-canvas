# Environment Configuration

## 📋 Übersicht

Die Canvas-Version nutzt `environment.ts` für alle Konfigurationseinstellungen.

## ⚙️ Konfigurationsoptionen

### OpenAI Settings

```typescript
openai: {
  apiKey: 'sk-proj-...',          // Ihr OpenAI API Key
  baseUrl: '',                     // Optional: Custom OpenAI endpoint
  model: 'gpt-4o-mini',           // Model-Name
  temperature: 0.3,                // 0.0-1.0 (0.3 empfohlen)
  
  // GPT-5 spezifische Einstellungen
  gpt5: {
    reasoningEffort: 'medium',   // 'low' | 'medium' | 'high'
    verbosity: 'low'             // 'low' | 'medium' | 'high'
  }
}
```

### Canvas Worker Pool

```typescript
canvas: {
  maxWorkers: 10,    // Anzahl paralleler Extraktionen (5-20 empfohlen)
  timeout: 30000     // Timeout pro Feld in Millisekunden
}
```

## 🔧 Verfügbare Modelle

### OpenAI Modelle
- ✅ `gpt-4o-mini` (Standard, schnell & günstig)
- ✅ `gpt-4o` (Höhere Qualität)
- ✅ `gpt-4-turbo`
- ✅ `gpt-3.5-turbo`

### GPT-5 Modelle (falls verfügbar)
- ✅ `gpt-5` (Automatische Reasoning-Features)

### Custom Models
- ✅ Alle OpenAI-kompatiblen Endpoints

## 🎯 Worker-Pool Empfehlungen

| Workers | Use Case | Performance |
|---------|----------|-------------|
| 5 | Konservativ | Langsam aber stabil |
| 10 | **Standard** | **Optimal** |
| 15 | Aggressiv | Schnell, mehr API-Load |
| 20 | Maximum | Sehr schnell, evtl. Rate-Limits |

## 🚀 Performance nach Model

### gpt-4o-mini (empfohlen)
- **Speed**: ⚡⚡⚡⚡⚡
- **Cost**: 💰 (~$0.003 / 30 Felder)
- **Quality**: ⭐⭐⭐⭐

### gpt-4o
- **Speed**: ⚡⚡⚡⚡
- **Cost**: 💰💰💰 (~$0.03 / 30 Felder)
- **Quality**: ⭐⭐⭐⭐⭐

### gpt-4-turbo
- **Speed**: ⚡⚡⚡
- **Cost**: 💰💰 (~$0.015 / 30 Felder)
- **Quality**: ⭐⭐⭐⭐⭐

## 🔒 Sicherheit

### Development
- ✅ API Key direkt in `environment.ts`
- ⚠️ **NIEMALS** in Git committen!
- ✅ `.gitignore` schützt `environment.ts`

### Production
```typescript
// environment.prod.ts
apiKey: '', // Leer lassen!
```

**Stattdessen:**
- Backend-Proxy nutzen
- Server-Umgebungsvariablen
- Azure Key Vault / AWS Secrets Manager

## 🧪 Testing verschiedener Konfigurationen

### Schnelle Tests (Development)
```typescript
openai: {
  model: 'gpt-4o-mini',
  temperature: 0.3
},
canvas: {
  maxWorkers: 15  // Schneller für Tests
}
```

### Qualitäts-Tests
```typescript
openai: {
  model: 'gpt-4o',
  temperature: 0.1  // Deterministischer
},
canvas: {
  maxWorkers: 5  // Weniger parallel, höhere Konsistenz
}
```

### Production-Ready
```typescript
openai: {
  model: 'gpt-4o-mini',
  temperature: 0.3
},
canvas: {
  maxWorkers: 10,
  timeout: 30000
}
```

## 🔧 Troubleshooting

### Fehler: "API Key not found"
```typescript
// Prüfen Sie environment.ts:
apiKey: 'sk-proj-...' // Muss gefüllt sein
```

### Fehler: "Rate limit exceeded"
```typescript
// Reduzieren Sie maxWorkers:
canvas: {
  maxWorkers: 5  // Statt 10
}
```

### Fehler: "Timeout"
```typescript
// Erhöhen Sie timeout:
canvas: {
  timeout: 60000  // 60 Sekunden
}
```

## 📝 Beispiel-Konfigurationen

### Minimal (günstiges Testing)
```typescript
openai: {
  apiKey: 'sk-...',
  model: 'gpt-3.5-turbo',
  temperature: 0.5
},
canvas: {
  maxWorkers: 5,
  timeout: 20000
}
```

### Optimal (Production)
```typescript
openai: {
  apiKey: 'sk-...',
  model: 'gpt-4o-mini',
  temperature: 0.3
},
canvas: {
  maxWorkers: 10,
  timeout: 30000
}
```

### Maximum (Hochleistung)
```typescript
openai: {
  apiKey: 'sk-...',
  model: 'gpt-4o',
  temperature: 0.2
},
canvas: {
  maxWorkers: 20,
  timeout: 45000
}
```

## 🌐 Custom Endpoints

### Azure OpenAI
```typescript
openai: {
  apiKey: 'your-azure-key',
  baseUrl: 'https://your-resource.openai.azure.com',
  model: 'gpt-4o-mini'
}
```

### Self-Hosted
```typescript
openai: {
  apiKey: 'optional',
  baseUrl: 'http://localhost:8080/v1',
  model: 'local-model'
}
```
