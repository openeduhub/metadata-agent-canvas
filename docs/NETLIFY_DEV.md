# 🚀 Lokale Entwicklung mit Netlify Dev

## Problem: CORS-Fehler beim lokalen Testen

Wenn die Canvas-Komponente lokal läuft (`npm start`), können Browser-Anfragen an edu-sharing Repository-APIs nicht direkt gemacht werden wegen **CORS (Cross-Origin Resource Sharing)**.

**Fehlermeldung:**
```
Create node failed: 400
```

## ✅ Lösung: Netlify Dev

Netlify Dev simuliert die Production-Umgebung lokal, inklusive Netlify Functions.

---

## 🛠️ Setup

### 1. Netlify CLI installieren

```bash
npm install -g netlify-cli
```

### 2. Netlify Dev starten

**Statt `npm start` verwenden:**

```bash
netlify dev
```

Das startet:
- Angular Dev Server auf Port 4200
- Netlify Functions auf Port 8888
- Proxy-Server der alles verbindet

---

## 🔄 Wie funktioniert es?

### **Ohne Netlify Dev (CORS-Fehler):**

```
Browser (localhost:4200)
  ↓ fetch()
  ❌ https://repository.staging.openeduhub.net
  ← CORS Error: Cross-Origin Request Blocked
```

### **Mit Netlify Dev (funktioniert):**

```
Browser (localhost:4200)
  ↓ fetch()
  ✅ http://localhost:8888/.netlify/functions/repository-proxy
  ↓ (Server-side, kein CORS)
  ✅ https://repository.staging.openeduhub.net
  ← Success!
```

---

## 📂 Netlify Functions

### **repository-proxy.js**

Proxies alle Repository-API-Calls:

```javascript
// netlify/functions/repository-proxy.js

export async function handler(event) {
  const { action, data } = JSON.parse(event.body);
  
  // Server-seitig (kein CORS!)
  switch (action) {
    case 'checkDuplicate':
      return await checkDuplicate(data.url);
    case 'createNode':
      return await createNode(data.metadata);
    case 'setMetadata':
      return await setMetadata(data.nodeId, data.metadata);
    case 'setCollections':
      return await setCollections(data.nodeId, data.collectionIds);
    case 'startWorkflow':
      return await startWorkflow(data.nodeId);
  }
}
```

### **openai-proxy.js**

Proxies OpenAI/LLM API Calls (bereits vorhanden).

---

## 🧪 Testing

### **1. Lokale Entwicklung:**

```bash
# Terminal 1: Netlify Dev starten
netlify dev

# Browser öffnet automatisch: http://localhost:8888

# Das leitet um zu Angular: http://localhost:4200
# ABER mit Netlify Functions Support!
```

### **2. Vorschlag einreichen testen:**

```bash
# 1. http://localhost:8888 öffnen (nicht :4200!)
# 2. URL eingeben: https://test.example.com
# 3. Felder ausfüllen
# 4. "Vorschlag einreichen" klicken

# Console prüfen:
"📮 Submitting metadata as guest via proxy..."
"✅ Node created: abc123..."
"✅ Metadata set"
"✅ Workflow started"
```

### **3. Proxy-Logs:**

```bash
# Terminal zeigt Netlify Function Logs:
Request from ::1: POST /.netlify/functions/repository-proxy
  action: checkDuplicate
  → No duplicate found

Request from ::1: POST /.netlify/functions/repository-proxy
  action: createNode
  → Node created: abc123...
```

---

## ⚙️ Konfiguration

### **guest-submission.service.ts**

Erkennt automatisch localhost und nutzt Proxy:

```typescript
private getProxyUrl(): string {
  // Localhost → Netlify Dev Proxy
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:8888/.netlify/functions/repository-proxy';
  }
  
  // Production → Deployed Netlify Functions
  return '/.netlify/functions/repository-proxy';
}
```

### **netlify.toml**

```toml
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
```

---

## 🚀 Deployment

### **Production:**

```bash
# Build & Deploy
npm run build
netlify deploy --prod

# Functions werden automatisch deployed:
# https://your-site.netlify.app/.netlify/functions/repository-proxy
```

**Keine Code-Änderungen nötig!**  
Der Service erkennt automatisch ob localhost oder Production.

---

## 📊 Vergleich: npm start vs. netlify dev

| Feature | `npm start` | `netlify dev` |
|---------|-------------|---------------|
| **Port** | 4200 | 8888 → 4200 |
| **Angular Dev Server** | ✅ | ✅ |
| **Hot Reload** | ✅ | ✅ |
| **Netlify Functions** | ❌ | ✅ |
| **Repository-Calls** | ❌ CORS | ✅ Via Proxy |
| **OpenAI-Calls** | ❌ CORS | ✅ Via Proxy |
| **Geocoding** | ❌ CORS | ✅ Via Proxy |

---

## 🐛 Troubleshooting

### **Fehler: "Function not found"**

```bash
# Prüfen ob Functions-Ordner existiert:
ls netlify/functions/

# Sollte zeigen:
# - openai-proxy.js
# - repository-proxy.js
# - photon.js
```

### **Fehler: "Port 8888 already in use"**

```bash
# Anderen Prozess auf Port 8888 beenden
# Oder anderer Port:
netlify dev --port 9999
```

### **Functions werden nicht geladen:**

```bash
# Netlify CLI neu installieren:
npm install -g netlify-cli@latest

# Oder Cache leeren:
rm -rf .netlify
netlify dev
```

---

## ✅ Checkliste

**Für lokale Entwicklung:**

- [ ] Netlify CLI installiert (`netlify --version`)
- [ ] `netlify dev` statt `npm start` verwenden
- [ ] Browser auf `http://localhost:8888` (nicht :4200)
- [ ] Functions-Logs im Terminal prüfen
- [ ] "Vorschlag einreichen" funktioniert ohne CORS-Fehler

**Für Production:**

- [ ] `netlify deploy --prod`
- [ ] Functions werden automatisch deployed
- [ ] Keine Code-Änderungen nötig

---

## 🎯 Zusammenfassung

**Problem:** CORS-Fehler beim lokalen Testen  
**Lösung:** Netlify Dev mit Functions als Proxy  
**Verwendung:** `netlify dev` statt `npm start`  
**Result:** ✅ Alle Repository-Calls funktionieren lokal!
