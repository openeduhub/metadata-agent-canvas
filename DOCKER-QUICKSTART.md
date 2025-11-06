# 🐳 Docker Quick Start

## 5-Minuten Setup

### 1. Environment konfigurieren

```bash
cp .env.docker.example .env
```

Bearbeite `.env`:
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-your-key-here
ALLOWED_ORIGINS=https://your-domain.com
```

### 2. Starten

```bash
docker-compose up -d
```

### 3. Testen

```bash
# Health Check
curl http://localhost:3000/api/health

# App öffnen
open http://localhost:3000
```

## ✅ Fertig!

Die Webkomponente läuft jetzt auf Port 3000 mit:
- ✅ Sicherem LLM-Proxy
- ✅ Rate Limiting (100 LLM-Requests/min - unterstützt 20 parallele Worker)
- ✅ CORS-Schutz
- ✅ Automatischen Health Checks

## 📚 Mehr Info

Siehe [DOCKER.md](DOCKER.md) für:
- Produktions-Deployment
- Sicherheitsoptionen
- Monitoring
- Troubleshooting
- Nginx-Reverse-Proxy
- Automatische Updates

## 🔒 Sicherheit

**Wichtig für Production:**
1. Verwende HTTPS (siehe `nginx.conf.example`)
2. Setze `ALLOWED_ORIGINS` auf deine Domain
3. Verwende starke API-Keys
4. Aktiviere Firewall-Regeln
5. Monitore die Logs

## 🔄 Updates

```bash
# Pull neueste Version
git pull

# Rebuild und Restart
docker-compose up -d --build
```

## 🆘 Probleme?

```bash
# Logs anzeigen
docker-compose logs -f

# Container neu starten
docker-compose restart

# Alles zurücksetzen
docker-compose down
docker-compose up -d --build
```

## 🌐 GitHub Container Registry

Images werden automatisch gebaut und sind verfügbar:

```bash
docker pull ghcr.io/openeduhub/metadata-agent-canvas:latest
```

Oder mit Tag:
```bash
docker pull ghcr.io/openeduhub/metadata-agent-canvas:v1.0.0
```
