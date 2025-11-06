# 🚀 Setup-Anleitung

## Voraussetzungen

### Windows
1. **Docker Desktop installieren** (falls noch nicht geschehen)
   - Download: https://www.docker.com/products/docker-desktop
   - Nach Installation: Docker Desktop starten
   - Warten bis "Docker Desktop is running" im System Tray erscheint

2. **Docker prüfen**
   ```powershell
   docker --version
   docker-compose --version
   ```

## Erstmalige Einrichtung

### 1. Environment-Datei erstellen

```powershell
# Im Projektverzeichnis
cp .env.docker.example .env
```

### 2. API-Key eintragen

Bearbeite `.env` mit deinem Editor:

**Für OpenAI:**
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-your-actual-key-here
ALLOWED_ORIGINS=http://localhost:3000
```

**Für B-API:**
```env
LLM_PROVIDER=b-api
B_API_URL=https://repository.staging.openeduhub.net
B_API_USER=your-username
B_API_PASSWORD=your-password
ALLOWED_ORIGINS=http://localhost:3000
```

### 3. Docker Container bauen und starten

```powershell
# Build und Start in einem Schritt
docker-compose up -d

# Logs anzeigen (optional)
docker-compose logs -f
```

**Erwartete Ausgabe:**
```
Creating metadata-agent-canvas ... done
```

### 4. Testen

```powershell
# Health Check
curl http://localhost:3000/api/health

# Oder im Browser öffnen
start http://localhost:3000
```

## Problembehebung

### ❌ "The system cannot find the file specified"

**Problem:** Docker Desktop läuft nicht

**Lösung:**
1. Docker Desktop starten
2. Warten bis grünes Symbol im System Tray
3. Erneut versuchen: `docker-compose up -d`

### ❌ "OPENAI_API_KEY is required"

**Problem:** API-Key nicht in `.env` gesetzt

**Lösung:**
1. `.env` Datei prüfen
2. API-Key eintragen
3. Container neu starten: `docker-compose restart`

### ❌ Container startet nicht

```powershell
# Logs anzeigen
docker-compose logs

# Container Status prüfen
docker-compose ps

# Komplett neu starten
docker-compose down
docker-compose up -d
```

### ❌ Port 3000 bereits belegt

```powershell
# In docker-compose.yml Port ändern:
ports:
  - "3001:3000"  # Verwende Port 3001 statt 3000
```

## Nützliche Commands

```powershell
# Container starten
docker-compose up -d

# Container stoppen
docker-compose down

# Logs anzeigen
docker-compose logs -f

# Container neu starten
docker-compose restart

# Container neu bauen (nach Code-Änderungen)
docker-compose up -d --build

# Status prüfen
docker-compose ps

# In Container-Shell einloggen (für Debugging)
docker exec -it metadata-agent-canvas sh
```

## Nächste Schritte

✅ Container läuft auf http://localhost:3000
✅ API erreichbar unter http://localhost:3000/api/health
✅ Für Produktion: Siehe [DOCKER.md](DOCKER.md)

### Production Deployment

Für produktiven Einsatz:
1. SSL/TLS einrichten (siehe `nginx.conf.example`)
2. `ALLOWED_ORIGINS` auf deine Domain setzen
3. Starke Passwörter verwenden
4. Monitoring einrichten
5. Backups konfigurieren

Details: [DOCKER.md](DOCKER.md)
