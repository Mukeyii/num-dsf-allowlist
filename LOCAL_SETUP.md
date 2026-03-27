# DSF Allow List – Lokale Installation

> Anleitung zum Starten der App auf einem Rechner mit Docker Desktop.
> Keine Vorkenntnisse nötig. Einfach Schritt für Schritt durchgehen.

---

## Voraussetzungen

- **Docker Desktop** installiert und gestartet
  - Windows: https://docs.docker.com/desktop/install/windows-install/
  - Mac: https://docs.docker.com/desktop/install/mac-install/
- **Git** installiert (oder das Projekt als ZIP entpackt)
- Ein Terminal (PowerShell, cmd, oder Git Bash)

---

## Schritt 1 – Projekt holen

**Option A: Git Clone (wenn Git installiert)**
```bash
git clone git@github.com:DEIN_USERNAME/dsf-allowlist.git
cd dsf-allowlist
```

**Option B: ZIP entpacken**
- ZIP-Datei in einen Ordner entpacken
- Terminal öffnen und in den Ordner navigieren:
```bash
cd pfad/zum/dsf-allowlist
```

---

## Schritt 2 – Umgebungsvariablen einrichten

```bash
# .env aus Vorlage erstellen
cp .env.example .env
```

Dann in der `.env`-Datei diese Werte setzen (mit einem Texteditor öffnen):

```
DB_PASSWORD=dev_password_change_me
DB_ROOT_PASSWORD=root_dev_password
```

Die restlichen Werte können auf den Defaults bleiben.

---

## Schritt 3 – Schlüssel generieren

**Mac / Linux / Git Bash:**
```bash
bash scripts/generate-keys.sh
```

**Windows PowerShell (falls kein Bash verfügbar):**
```powershell
# OpenSSL muss installiert sein (kommt mit Git for Windows mit)
# Im Git Bash ausführen:
"C:\Program Files\Git\bin\bash.exe" scripts/generate-keys.sh
```

Erwartete Ausgabe:
```
Generating RS256 key pair...
Done. Keys written to .env
```

---

## Schritt 4 – App starten

```bash
docker compose up --build -d
```

Das dauert beim ersten Mal 3–5 Minuten (Images werden heruntergeladen und gebaut).

**Prüfen ob alles läuft:**
```bash
docker compose ps
```

Alle 6 Services sollten `running` oder `healthy` zeigen:
- `nginx`
- `frontend`
- `backend`
- `db`
- `redis`
- `mail`

**Falls der Backend-Container neu startet (DB noch nicht ready):**
Einfach 30 Sekunden warten – er verbindet sich automatisch, sobald MySQL healthy ist.

---

## Schritt 5 – Ersten Admin-User anlegen

```bash
docker compose exec backend npx ts-node src/db/seed-whitelist.ts deine@email.de
```

Ersetze `deine@email.de` mit deiner gewünschten Login-E-Mail.

Erwartete Ausgabe:
```
✓ Whitelisted: deine@email.de
```

---

## Schritt 6 – App öffnen

| Was | URL |
|-----|-----|
| **Die App** | http://localhost |
| **Mailhog** (E-Mails ansehen) | http://localhost:8025 |
| **Backend Health-Check** | http://localhost:3000/health |

### Login-Flow:

1. http://localhost öffnen
2. Deine E-Mail eingeben → "Send code"
3. http://localhost:8025 öffnen → E-Mail mit 6-stelligem Code finden
4. Code eingeben
5. Beim ersten Login: QR-Code mit Authenticator-App scannen (Google Authenticator, Authy, etc.)
6. 6-stelligen Code aus der App eingeben
7. Backup-Codes sicher aufbewahren
8. Fertig – du bist eingeloggt

---

## Nützliche Befehle

```bash
# Logs ansehen (alle Services)
docker compose logs -f

# Nur Backend-Logs
docker compose logs -f backend

# App stoppen
docker compose down

# App stoppen und alle Daten löschen (Neustart)
docker compose down -v

# App neu bauen nach Code-Änderungen
docker compose up --build -d

# In die Datenbank schauen
docker compose exec db mysql -u dsf -pdev_password_change_me dsf_allowlist

# Alle Tabellen anzeigen
docker compose exec db mysql -u dsf -pdev_password_change_me dsf_allowlist -e "SHOW TABLES;"

# Redis testen
docker compose exec redis redis-cli ping

# Weitere E-Mail whitelisten
docker compose exec backend npx ts-node src/db/seed-whitelist.ts neue@email.de
```

---

## Fehlerbehebung

### "Port already in use"
Ein anderer Dienst belegt Port 80, 3000 oder 3306.
```bash
# Windows: Welcher Prozess belegt Port 80?
netstat -ano | findstr :80

# Oder einfach die Ports in docker-compose.yml ändern:
# z.B. "8080:80" statt "80:80" → dann http://localhost:8080
```

### "Database connection failed"
MySQL braucht beim ersten Start ~30 Sekunden. Backend startet automatisch neu.
```bash
# Status prüfen
docker compose ps
# Wenn db "healthy" zeigt aber backend noch restartet: einfach warten
```

### "generate-keys.sh: Permission denied"
```bash
chmod +x scripts/generate-keys.sh
bash scripts/generate-keys.sh
```

### "Docker not found"
Docker Desktop muss gestartet sein (Whale-Icon in der Taskbar/Menubar).

---

## Ports-Übersicht

| Port | Service | Beschreibung |
|------|---------|--------------|
| 80 | nginx | Reverse Proxy → Frontend + Backend |
| 443 | nginx | HTTPS (nur in Produktion) |
| 5173 | frontend | Vite Dev Server (direkt) |
| 3000 | backend | Express API (direkt) |
| 3306 | db | MySQL |
| 6379 | redis | Redis |
| 1025 | mail | Mailhog SMTP |
| 8025 | mail | Mailhog Web UI |
