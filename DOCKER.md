# 🐳 Docker Deployment Guide

## Übersicht

Dieses Repository enthält eine vollständige Docker-Lösung für die Metadata Agent Canvas Webkomponente mit integriertem, sicherem LLM-Proxy.

### Sicherheitsfeatures

✅ **Multi-Stage Build** - Minimale Image-Größe
✅ **Non-Root User** - Container läuft als unprivilegierter Benutzer
✅ **Rate Limiting** - Schutz vor Missbrauch (10 LLM-Requests/Min, 100 API-Requests/15Min)
✅ **CORS Protection** - Nur konfigurierte Origins erlaubt
✅ **Request Size Limits** - Max. 100KB Request-Größe
✅ **Security Headers** - Helmet.js für HTTP-Security
✅ **Read-Only Filesystem** - Container-Filesystem ist read-only
✅ **Health Checks** - Automatische Überwachung
✅ **Resource Limits** - CPU/Memory-Limits

## 🚀 Quick Start

### 1. Repository klonen

```bash
git clone https://github.com/openeduhub/metadata-agent-canvas.git
cd metadata-agent-canvas
```

### 2. Environment-Variablen konfigurieren

```bash
# Kopiere Template
cp .env.docker.example .env

# Bearbeite .env mit deinen Werten
nano .env  # oder vim, code, etc.
```

**Minimal-Konfiguration (OpenAI):**
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-your-key-here
ALLOWED_ORIGINS=https://your-domain.com
```

**Oder B-API:**
```env
LLM_PROVIDER=b-api
B_API_URL=https://repository.staging.openeduhub.net
B_API_USER=your-username
B_API_PASSWORD=your-password
B_API_CONFIG_NODE_ID=your-config-node-id
ALLOWED_ORIGINS=https://your-domain.com
```

### 3. Mit Docker Compose starten

```bash
# Build und Start
docker-compose up -d

# Logs anzeigen
docker-compose logs -f

# Status prüfen
docker-compose ps
```

### 4. Testen

```bash
# Health Check
curl http://localhost:3000/api/health

# Erwartete Antwort:
# {"status":"ok","timestamp":"2025-11-05T12:00:00.000Z","provider":"openai","version":"1.0.0"}
```

App öffnen: http://localhost:3000

## 📦 Manuelle Docker Commands

### Build

```bash
# Image bauen
docker build -t metadata-agent-canvas:latest .

# Mit Build-Args
docker build \
  --build-arg NODE_VERSION=20 \
  -t metadata-agent-canvas:latest .
```

### Run

```bash
# Container starten
docker run -d \
  --name metadata-agent-canvas \
  -p 3000:3000 \
  -e LLM_PROVIDER=openai \
  -e OPENAI_API_KEY=sk-proj-your-key \
  -e ALLOWED_ORIGINS=https://your-domain.com \
  --restart unless-stopped \
  metadata-agent-canvas:latest

# Mit .env-Datei
docker run -d \
  --name metadata-agent-canvas \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  metadata-agent-canvas:latest
```

## 🔧 Konfiguration

### Environment-Variablen

| Variable | Erforderlich | Standard | Beschreibung |
|----------|-------------|----------|--------------|
| `NODE_ENV` | Nein | `production` | Node Environment |
| `PORT` | Nein | `3000` | Server Port |
| `ALLOWED_ORIGINS` | Ja | - | Komma-separierte Liste erlaubter Origins |
| `RATE_LIMIT_LLM_MAX` | Nein | `100` | Max. LLM-Requests pro Minute |
| `RATE_LIMIT_API_MAX` | Nein | `1000` | Max. API-Requests pro 15 Minuten |
| `LLM_PROVIDER` | Ja | `openai` | LLM Provider: `openai` oder `b-api` |
| `OPENAI_API_KEY` | Ja (OpenAI) | - | OpenAI API Key |
| `B_API_URL` | Ja (B-API) | - | B-API Basis-URL |
| `B_API_USER` | Ja (B-API) | - | B-API Benutzername |
| `B_API_PASSWORD` | Ja (B-API) | - | B-API Passwort |
| `B_API_CONFIG_NODE_ID` | Nein | - | B-API Config Node ID |

### Rate Limits

**API Endpoints** (`/api/*`):
- 1000 Requests pro 15 Minuten pro IP

**LLM Proxy** (`/api/openai-proxy`):
- 100 Requests pro Minute pro IP

Diese Limits sind so konfiguriert, dass sie **20 parallele Worker** unterstützen, die gleichzeitig Metadaten extrahieren. Die Limits schützen vor Missbrauch und können bei Bedarf in `server/index.js` angepasst werden.

**Rechenbeispiel:**
- 20 Worker × 5 Felder pro Ressource = 100 Requests/Minute
- Bei komplexen Schemata mit vielen Feldern ggf. Limits erhöhen

**Anpassung für mehr Worker:**

Wenn du mehr als 20 parallele Worker nutzt, setze die Limits entsprechend in `.env`:

```env
# Für 50 Worker
RATE_LIMIT_LLM_MAX=250      # 50 Worker × 5 Felder
RATE_LIMIT_API_MAX=2500     # 10x LLM Limit

# Für 100 Worker
RATE_LIMIT_LLM_MAX=500
RATE_LIMIT_API_MAX=5000
```

### CORS

Standardmäßig sind **alle Origins blockiert**. Konfiguriere erlaubte Origins:

```env
# Einzelne Origin
ALLOWED_ORIGINS=https://your-domain.com

# Mehrere Origins
ALLOWED_ORIGINS=https://domain1.com,https://domain2.com,http://localhost:4200

# Alle Origins (NICHT empfohlen für Production!)
ALLOWED_ORIGINS=*
```

## 🔐 Sicherheit

### ⚠️ WICHTIG: Port-Binding Security

**Standard-Konfiguration (docker-compose.yml):**
```yaml
ports:
  - "3001:3001"  # ⚠️ Port ist öffentlich erreichbar!
```

**Problem:**  
Der Container-Port wird auf **alle Netzwerk-Interfaces** gebunden. Das bedeutet:
- ✅ Zugriff über `http://localhost:3001` funktioniert
- ❌ **Zugriff über `http://deine-server-ip:3001` auch!**
- 🔴 **Jeder im Netzwerk/Internet kann den Proxy nutzen!**

---

### 🛡️ Sicherheitsoptionen

#### **Option 1: Nur Localhost-Zugriff** (Empfohlen für lokale Deployments)

```yaml
# docker-compose.yml
ports:
  - "127.0.0.1:3001:3001"  # ✅ Nur localhost!
```

**Effekt:**
- ✅ App erreichbar: `http://localhost:3001`
- ❌ Extern NICHT erreichbar: `http://server-ip:3001` → Connection refused
- ✅ Kein Proxy-Missbrauch möglich

**Einsatzbereich:**  
Lokale Entwicklung, Desktop-Server, wenn kein externer Zugriff nötig ist.

---

#### **Option 2: Nginx Reverse Proxy mit SSL** (Empfohlen für Produktion)

**docker-compose.yml** (aktiviere Nginx):
```yaml
services:
  nginx:
    image: nginx:alpine
    container_name: metadata-agent-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - metadata-agent-canvas

  metadata-agent-canvas:
    # Port NICHT exponieren, nur intern erreichbar
    expose:
      - "3001"
    # NICHT:
    # ports:
    #   - "3001:3001"
```

**nginx.conf:**
```nginx
upstream metadata_agent {
    server metadata-agent-canvas:3001;
}

server {
    listen 443 ssl http2;
    server_name metadata-agent.your-domain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # Rate Limiting auf Nginx-Ebene
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    # IP Whitelisting (optional)
    # allow 192.168.1.0/24;
    # deny all;

    location / {
        proxy_pass http://metadata_agent;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Vorteile:**
- ✅ SSL/TLS Verschlüsselung
- ✅ Nginx Rate Limiting (zusätzlich zu Express)
- ✅ IP Whitelisting möglich
- ✅ DDoS Protection
- ✅ Access Logs
- ✅ Container nur intern erreichbar

---

#### **Option 3: Firewall-Regeln** (Zusätzlicher Schutz)

**Windows Firewall:**
```powershell
# Nur bestimmtes Netzwerk erlauben
New-NetFirewallRule -DisplayName "Metadata Agent Canvas" `
  -Direction Inbound -LocalPort 3001 -Protocol TCP `
  -RemoteAddress 192.168.1.0/24 -Action Allow

# Alle anderen blockieren
New-NetFirewallRule -DisplayName "Metadata Agent Block Public" `
  -Direction Inbound -LocalPort 3001 -Protocol TCP `
  -Action Block
```

**Linux (ufw):**
```bash
# Nur lokales Netzwerk
sudo ufw allow from 192.168.1.0/24 to any port 3001

# Oder nur localhost
sudo ufw allow from 127.0.0.1 to any port 3001
```

**Linux (iptables):**
```bash
# Nur 192.168.1.0/24 erlauben
iptables -A INPUT -p tcp --dport 3001 -s 192.168.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 3001 -j DROP
```

---

### 🔒 Best Practices für Produktion

1. **HTTPS verwenden** (Nginx Reverse Proxy)
   - Let's Encrypt für kostenlose SSL-Zertifikate
   - Automatische Renewal mit Certbot

2. **Starke API-Keys**
   - Mindestens 32 Zeichen
   - Niemals im Code hardcoden
   - Regelmäßig rotieren
   - Docker Secrets oder Vault nutzen

3. **Restricted CORS**
   ```env
   # NUR spezifische Domains, NIEMALS "*"
   ALLOWED_ORIGINS=https://app.openeduhub.net,https://editor.openeduhub.net
   ```

4. **Rate Limiting anpassen**
   ```env
   # Für Produktion höhere Limits
   RATE_LIMIT_LLM_MAX=1000    # 1000 LLM-Requests/Min
   RATE_LIMIT_API_MAX=10000   # 10000 API-Requests/15Min
   ```
   
   **Aber beachte:**
   - Höhere Limits = höheres Missbrauchs-Risiko
   - Monitoring der Logs wichtig
   - Kosten im Auge behalten (OpenAI API)

5. **Resource Limits** (bereits in docker-compose.yml)
   ```yaml
   resources:
     limits:
       cpus: '1.0'
       memory: 1024M
   ```

6. **Log Monitoring**
   ```bash
   # Rate Limit Überschreitungen überwachen
   docker-compose logs -f | grep "Too many requests"
   
   # Unbekannte Origins (potenzielle Angriffe)
   docker-compose logs -f | grep "Blocked request from origin"
   ```

7. **Netzwerk-Isolation**
   ```yaml
   # docker-compose.yml
   networks:
     internal:
       driver: bridge
       internal: true  # Kein Internet-Zugriff
     
   services:
     metadata-agent-canvas:
       networks:
         - internal
         - default  # Nur für externe Requests
   ```

---

### 🚨 Risiko-Szenarien & Mitigationen

| Risiko | Beschreibung | Mitigation |
|--------|--------------|------------|
| **API-Key Missbrauch** | Externe nutzen deinen Proxy für eigene LLM-Calls | ✅ CORS-Whitelist, ✅ Rate Limiting, ✅ Localhost-Binding |
| **DoS-Angriffe** | Flut von Requests überlastet Server | ✅ Rate Limiting, ✅ Resource Limits, ✅ Nginx |
| **Credential Theft** | API-Keys in Logs/Code | ✅ Docker Secrets, ✅ .env in .gitignore, ✅ Secret Scanning |
| **CORS-Bypass** | Wildcard `*` erlaubt alle Origins | ✅ Explizite ALLOWED_ORIGINS, ✅ Niemals `*` in Produktion |
| **MitM-Angriffe** | Unverschlüsselte Verbindung | ✅ HTTPS/SSL, ✅ Nginx mit TLS 1.3 |

---

### 📊 Security Checklist

**Vor Deployment:**
- [ ] `.env` nicht in Git committen
- [ ] `ALLOWED_ORIGINS` auf spezifische Domains gesetzt
- [ ] API-Keys validiert und rotiert
- [ ] Port-Binding geprüft (`127.0.0.1:3001` oder Nginx)
- [ ] Rate Limits konfiguriert
- [ ] HTTPS aktiviert (Nginx + Let's Encrypt)
- [ ] Firewall-Regeln gesetzt
- [ ] Health Check funktioniert
- [ ] Logs-Monitoring eingerichtet

**Nach Deployment:**
- [ ] Health Check regelmäßig testen
- [ ] Logs auf Anomalien prüfen
- [ ] API-Kosten überwachen (OpenAI Dashboard)
- [ ] Container-Resources überwachen (`docker stats`)
- [ ] Backups der Konfiguration

### Security Headers

Der Server setzt automatisch folgende Headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (wenn HTTPS)
- Content Security Policy (CSP)

## 🔄 Updates & Wartung

### Automatische Updates von GitHub

#### Mit Watchtower (empfohlen)

```bash
# Watchtower für automatische Updates
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 3600 \
  --cleanup \
  metadata-agent-canvas
```

#### Manuelles Update

```bash
# 1. Neues Image bauen
git pull
docker-compose build --no-cache

# 2. Container neu starten
docker-compose down
docker-compose up -d

# 3. Alte Images aufräumen
docker image prune -f
```

### GitHub Actions CI/CD

Erstelle `.github/workflows/docker-publish.yml`:

```yaml
name: Docker Build & Push

on:
  push:
    branches: [ main ]
  release:
    types: [ published ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker Image
        run: docker build -t metadata-agent-canvas:latest .
      
      - name: Push to Registry
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
          docker tag metadata-agent-canvas:latest your-registry/metadata-agent-canvas:latest
          docker push your-registry/metadata-agent-canvas:latest
```

### Backup & Rollback

```bash
# Tag aktuelle Version
docker tag metadata-agent-canvas:latest metadata-agent-canvas:v1.0

# Bei Problemen: Zurück zur alten Version
docker-compose down
docker tag metadata-agent-canvas:v1.0 metadata-agent-canvas:latest
docker-compose up -d
```

## 📊 Monitoring

### Health Check

```bash
# Status prüfen
curl http://localhost:3000/api/health

# Mit jq für schöne Ausgabe
curl -s http://localhost:3000/api/health | jq
```

### Container Logs

```bash
# Alle Logs
docker-compose logs

# Letzte 100 Zeilen
docker-compose logs --tail=100

# Live-Logs
docker-compose logs -f

# Nur Fehler
docker-compose logs | grep ERROR
```

### Resource-Nutzung

```bash
# CPU/Memory-Nutzung
docker stats metadata-agent-canvas

# Disk-Nutzung
docker system df
```

### Prometheus Metrics (optional)

Erweitere `server/index.js` mit `prom-client`:

```javascript
const promClient = require('prom-client');
const register = new promClient.Registry();

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## 🐛 Troubleshooting

### Container startet nicht

```bash
# Logs anzeigen
docker-compose logs

# Häufige Probleme:
# 1. Fehlende ENV-Variablen
# 2. Port bereits belegt
# 3. Ungültiger API-Key
```

### Port bereits belegt

```bash
# Port ändern in docker-compose.yml
ports:
  - "3001:3000"  # Host:Container
```

### CORS-Fehler

```bash
# Origin zur ALLOWED_ORIGINS hinzufügen
ALLOWED_ORIGINS=https://your-domain.com,http://localhost:4200
```

### Rate Limit Fehler

```bash
# Limits in server/index.js erhöhen
const proxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,  # Erhöht von 10
});
```

### API-Key ungültig

```bash
# Prüfe .env-Datei
cat .env | grep API_KEY

# Neustart erforderlich nach Änderung
docker-compose restart
```

## 📁 Datei-Struktur

```
metadata-agent-canvas/
├── Dockerfile                 # Multi-Stage Build
├── docker-compose.yml         # Orchestrierung
├── .dockerignore             # Ausgeschlossene Dateien
├── .env.docker.example       # ENV-Template
├── server/
│   ├── index.js              # Express Server mit Proxy
│   ├── healthcheck.js        # Health Check Script
│   └── package.json          # Server Dependencies
├── src/                      # Angular App
└── dist/                     # Gebaut im Container
```

## 🌐 Produktions-Deployment

### Mit Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name metadata-agent.openeduhub.net;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name metadata-agent.openeduhub.net;

    ssl_certificate /etc/letsencrypt/live/metadata-agent.openeduhub.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/metadata-agent.openeduhub.net/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Mit Docker Secrets (Kubernetes/Swarm)

```yaml
version: '3.8'
services:
  metadata-agent-canvas:
    secrets:
      - openai_api_key
    environment:
      - OPENAI_API_KEY_FILE=/run/secrets/openai_api_key

secrets:
  openai_api_key:
    external: true
```

## 📚 Weitere Ressourcen

- **GitHub:** https://github.com/openeduhub/metadata-agent-canvas
- **OpenAI API:** https://platform.openai.com/docs
- **Docker Docs:** https://docs.docker.com
- **Docker Compose:** https://docs.docker.com/compose

## 🆘 Support

Bei Problemen:
1. Prüfe Logs: `docker-compose logs`
2. Health Check: `curl http://localhost:3000/api/health`
3. Issue erstellen: https://github.com/openeduhub/metadata-agent-canvas/issues
