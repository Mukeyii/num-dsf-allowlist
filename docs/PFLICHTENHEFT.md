# Pflichtenheft – DSF Allow List Management Portal

**Version:** 1.0
**Datum:** 2026-03-28
**Auftraggeber:** Institute of Medical Informatics Muenster (IMI), Universität Münster
**Projektbezeichnung:** DSF Allow List Management Portal (Rewrite)

---

## Inhaltsverzeichnis

1. [Zielbestimmung](#1-zielbestimmung)
2. [Produkteinsatz](#2-produkteinsatz)
3. [Produktumgebung](#3-produktumgebung)
4. [Produktdaten](#4-produktdaten)
5. [Produktfunktionen](#5-produktfunktionen)
6. [Qualitätsanforderungen](#6-qualitätsanforderungen)
7. [Benutzeroberfläche](#7-benutzeroberfläche)
8. [Nichtfunktionale Anforderungen](#8-nichtfunktionale-anforderungen)
9. [Testfälle](#9-testfälle)
10. [Glossar](#10-glossar)

---

## 1 Zielbestimmung

Das DSF Allow List Management Portal ist eine webbasierte Verwaltungsapplikation für das *Data Sharing Framework* (DSF) medizinischer Forschungsnetze (MII, NUM, Medizininformatik-Initiative). Das Portal ermöglicht dem Institute of Medical Informatics Muenster (IMI) der Universität Münster, ein zentrales Verzeichnis teilnehmender Institutionen zu pflegen, Änderungsanträge zu prüfen und freigegebene Datenpakete (FHIR Bundles, IP-Listen) zu publizieren.

### 1.1 Musskriterien

| Kennung | Beschreibung |
|---------|--------------|
| **Authentifizierung** | |
| /M010/ | Das System muss eine passwortlose Authentifizierung per E-Mail-OTP (One-Time Password) implementieren. Ein 6-stelliger Code wird per E-Mail versandt, ist 10 Minuten gültig und einmalig verwendbar. |
| /M011/ | Das System muss nach erfolgreicher OTP-Verifikation eine TOTP-basierte Zwei-Faktor-Authentifizierung (Authenticator-App) erzwingen. Beim ersten Login wird ein QR-Code zur Einrichtung angezeigt. |
| /M012/ | Das System muss JWT-Sessions mit RS256-Signatur (asymmetrisch) ausgeben. Access Token TTL: 15 Minuten; Refresh Token als httpOnly-Cookie, TTL: 7 Tage, widerrufbar über Redis. |
| /M013/ | Das System muss alle Auth-Routen mit Rate Limiting schützen: maximal 5 Anfragen pro 15 Minuten pro IP-Adresse. |
| /M014/ | Das System muss E-Mail-Adressen gegen eine Whitelist in der Datenbank prüfen. Nicht-whitelisted Adressen erhalten eine generische Fehlermeldung ohne Hinweis auf Existenz. |
| /M015/ | Das System muss 10 Backup-Codes für TOTP generieren, bcrypt-gehasht speichern und jeden Code als einmalig verwendbar markieren. |
| /M016/ | Das System muss Sessions nach einem Seiten-Neuladen wiederherstellen (Session Restore via Refresh Token). |
| **Instanzen** | |
| /M020/ | Das System muss die Erstellung mehrerer DSF-Instanzen pro Benutzer erlauben. Jede Instanz hat ein Label (FQDN oder UUID). |
| /M021/ | Das System muss einen Instanz-Wechsler bereitstellen, der alle Entitäten der gewählten Instanz lädt. |
| /M022/ | Jede Instanz muss ein vollständig unabhängiges Datenset besitzen (Organisation, Kontakte, Endpoints, Zertifikate, Mitgliedschaften). |
| **Organisation** | |
| /M030/ | Das System muss für jede Instanz genau eine Organisation speichern und anzeigen. Die Organisation ist die Wurzel-Entität des Entity-Graphen. |
| /M031/ | Das System muss das Bearbeiten aller Organisationsfelder ermöglichen: Identifier (FQDN), Name, Aktiv-Status, E-Mail, Adresse (Straße, PLZ, Stadt, Land). |
| /M032/ | Das System muss eine Lösch-/Abmeldungsanfrage für die Organisation ermöglichen, die als Approval-Request an den Admin gesendet wird. |
| **Kontakte** | |
| /M040/ | Das System muss vollständiges CRUD für Kontakte einer Organisation implementieren. |
| /M041/ | Kontakte müssen einen oder mehrere Typen haben: MEDIC, DSF_ADMIN, SECURITY. |
| /M042/ | Das System muss den E-Mail-Verifikationsstatus eines Kontakts anzeigen und eine Verifikations-E-Mail erneut versenden können. |
| /M043/ | Das System muss DSGVO-konforme Datenhaltung sicherstellen: Kontaktdaten werden nicht in das öffentliche Allow-List-Bundle eingebettet. |
| /M044/ | Kontaktfelder: Name, E-Mail, Telefon, Adresse (Straße, PLZ, Stadt, Land). |
| **Endpoints** | |
| /M050/ | Das System muss vollständiges CRUD für Endpoints einer Organisation implementieren. |
| /M051/ | Endpoints müssen folgende Pflichtfelder besitzen: Identifier (FQDN), Name, FHIR-URL (Adresse). |
| /M052/ | Jedem Endpoint müssen beliebig viele IP-Adressen zugeordnet werden können, jeweils mit den Flags `is_fhir` und `is_bpe`. |
| /M053/ | Das System muss die Eindeutigkeit des Endpoint-Identifiers (FQDN) prüfen. |
| **Zertifikate** | |
| /M060/ | Das System muss den Upload eines X.509-Zertifikats im PEM-Format ermöglichen. |
| /M061/ | Das System muss PEM-Inhalte automatisch parsen und Metadaten extrahieren: Subject, Thumbprint (SHA-256), Ablaufdatum. |
| /M062/ | Das System muss den Upload von Private Keys ablehnen (HTTP 400) und darf den PEM-Inhalt eines Private Keys nicht in Logs schreiben. |
| /M063/ | Das System muss das Ablaufdatum jedes Zertifikats anzeigen. |
| /M064/ | Das System muss das Löschen eines Zertifikats ermöglichen. |
| /M065/ | Das System muss ein Warn-Banner anzeigen, wenn ein Zertifikat weniger als 30 Tage gültig ist oder bereits abgelaufen ist. |
| **Mitgliedschaften** | |
| /M070/ | Das System muss vollständiges CRUD für Mitgliedschaften einer Organisation implementieren. |
| /M071/ | Mitgliedschaften müssen folgende Felder besitzen: übergeordnete Organisation (Parent), zugeordneter Endpoint, Rollen (DIC, HRP, DMS, AMS – Mehrfachauswahl). |
| /M072/ | Das System muss die Zuordnung eines Endpoints zu einer Mitgliedschaft über eine Fremdschlüssel-Relation darstellen. |
| **Approval-Workflow** | |
| /M080/ | Das System muss das Einreichen eines Änderungsantrags (Approval Request) mit vollständigem Daten-Snapshot ermöglichen. |
| /M081/ | Der Approval-Workflow muss folgende Zustände implementieren: DRAFT → PENDING → APPROVED / REJECTED. |
| /M082/ | Das System muss eine vollständige Antragshistorie pro Instanz anzeigen. |
| /M083/ | IMI-Admins müssen ausstehende Anträge einsehen, genehmigen oder ablehnen können (mit Kommentarfeld). |
| /M084/ | Das System muss den Approval-Status auf der Hauptseite sichtbar darstellen. |
| **Downloads** | |
| /M090/ | Das System muss ein FHIR R4 Bundle im JSON-Format für eine Instanz generieren und zum Download bereitstellen. |
| /M091/ | Das System muss eine IP-Adressliste aller Endpoints als Excel-Datei (.xlsx) exportieren. |
| **Audit Log** | |
| /M100/ | Das System muss alle schreibenden Operationen in einem append-only Audit Log protokollieren. Einträge dürfen nicht verändert oder gelöscht werden. |
| /M101/ | Das Audit Log muss filterbar sein nach: Ressourcentyp, Operation, Zeitraum. |
| /M102/ | Das Audit Log muss paginiert abgerufen werden können. |
| /M103/ | Das Audit Log muss alle folgenden Operationen erfassen: CREATE, UPDATE, DELETE, APPROVE, REJECT, LOGIN, LOGOUT, OTP_REQUEST, OTP_VERIFY, TOTP_SETUP, TOTP_VERIFY. |
| **Canvas-UI** | |
| /M110/ | Das System muss alle Entitäten einer Instanz gleichzeitig auf einem einzigen Canvas anzeigen, ohne Tab-Switching oder Seitenwechsel. |
| /M111/ | Das System muss Beziehungen zwischen Entitäten als SVG-Linien (Bezier-Kurven) darstellen, die bei Fenstergröße-Änderungen neu berechnet werden. |
| /M112/ | Das System muss beim Hovern über eine Entitätskarte alle zugehörigen Fremdschlüssel-Relationen hervorheben (FK-Highlight). |
| /M113/ | Das Canvas muss in einem 3-Spalten-Grid-Layout organisiert sein: Linke Spalte (Organisation, Kontakte), Mittlere Spalte (Endpoints, Zertifikate), Rechte Spalte (Mitgliedschaften, Approval). |
| /M114/ | Das System muss als Single-Page-Application ohne vollständige Seitenneuladen funktionieren. |

#### Admin-Review-Oberfläche
- **/M120/** Dedizierte Admin-Seite (`/app/admin`) zur Prüfung ausstehender Approval-Requests
- **/M121/** Anzeige aller PENDING-Requests mit Organisations-Snapshot (Org, Endpoints, Zertifikate, Memberships)
- **/M122/** Approve/Reject-Aktionen erfordern TOTP-Re-Bestätigung (6-stelliger Authenticator-Code)
- **/M123/** Ablehnungen erfordern einen Kommentar

#### E-Mail-Benachrichtigungen
- **/M130/** E-Mail an alle IMI-Admins bei neuem Approval-Request (sofort)
- **/M131/** E-Mail an alle IMI-Admins bei Genehmigung/Ablehnung (sofort)
- **/M132/** E-Mail an Standort-Kontakte bei Genehmigung/Ablehnung (30 Minuten verzögert, mit Status-Re-Check)
- **/M133/** Automatische Erinnerungs-E-Mail bei > 3 Tage offenen Requests (täglicher Cron-Job)

#### Testen
- **/M140/** Backend-API-Integrationstests mit Jest + Supertest
- **/M141/** Frontend-Unit-Tests mit Vitest + MSW
- **/M142/** Test-Seed-Daten für reproduzierbare Testläufe

#### Bundle-Sicherheit
- **/M150/** RS256-Signatur auf jedem generierten FHIR-Bundle (Header X-Bundle-Signature)
- **/M151/** SHA-256 Content-Hash im Audit Log bei jedem Bundle-Download
- **/M152/** mTLS Client-Zertifikat-Authentifizierung für DSF-Prozesse (/fhir/Bundle)
- **/M153/** Client-Zertifikats-Thumbprint pro Organisation konfigurierbar

#### Zertifikats-Erneuerung
- **/M160/** Dedizierter Renewal-Wizard (altes Cert auswählen → neues hochladen → vergleichen → bestätigen)
- **/M161/** Drag-and-Drop PEM-Upload im Renewal-Flow

#### UX-Verbesserungen
- **/M170/** Undo-Funktion bei Löschaktionen (10 Sekunden Rückgängig-Toast)
- **/M171/** Status-Dashboard mit Übersicht (Entity-Zähler, Approval-Status, Zertifikats-Ablauf)

### 1.2 Sollkriterien

| Kennung | Beschreibung |
|---------|--------------|
| /S010/ | Das System sollte eine Dark-Mode-Option bereitstellen. |
| /S020/ | Das System sollte Inline-Validierungsfehler in Formularen in Echtzeit anzeigen (on-blur und on-submit). |
| /S030/ | Das System sollte Toast-Notifications für Erfolgs- und Fehlermeldungen anzeigen. |
| /S040/ | Das System sollte eine Suche/Filterung innerhalb der Entitätslisten ermöglichen. |
| /S050/ | Das System sollte beim Zertifikat-Upload eine Vorschau der geparsten Metadaten vor dem Speichern anzeigen. |
| /S060/ | Das System sollte eine Instanz-Wechselanimation mit Loading-State implementieren. |
| /S070/ | Das System sollte eine Statistik-Übersicht im Right Panel anzeigen (Anzahl Kontakte, Endpoints, Zertifikate, Mitgliedschaften). |
| /S080/ | Das System sollte eine E-Mail-Benachrichtigung an den Instance-Owner versenden, wenn ein Approval Request genehmigt oder abgelehnt wurde. |

### 1.3 Abgrenzungskriterien

| Kennung | Beschreibung |
|---------|--------------|
| /A010/ | Das System wird keine öffentlich zugängliche Registrierung implementieren. Zugang nur über Admin-verwaltete E-Mail-Whitelist. |
| /A020/ | Das System wird keine Passwort-basierte Authentifizierung implementieren. |
| /A030/ | Das System wird keine direkten DSF-Knoten-Verbindungen herstellen oder DSF-Protokolle sprechen. |
| /A040/ | Das System wird keine automatische Synchronisation mit externen Verzeichnisdiensten (LDAP, Active Directory) implementieren. |
| /A050/ | Das System wird keine rollenbasierte Benutzerberechtigungen auf Entitätsebene implementieren. Jeder authentifizierte Benutzer hat vollen Zugriff auf seine Instanzen. |
| /A060/ | Das System wird keine mobil-optimierte Ansicht (responsive Layout für Smartphones) implementieren. |
| /A070/ | Das System wird keine Versionierung von Entitätsdaten implementieren (außer dem Snapshot im Approval Request). |

---

## 2 Produkteinsatz

### 2.1 Anwendungsbereiche

Das Portal wird vom Institute of Medical Informatics Muenster (IMI) der Universität Münster betrieben und dient als zentrales Verwaltungswerkzeug für das Data Sharing Framework medizinischer Forschungsnetze. Konkrete Anwendungsbereiche:

- **Onboarding neuer DSF-Teilnehmer:** Erfassung und Pflege aller technischen und organisatorischen Daten einer neuen Institution.
- **Zertifikatsverwaltung:** Überwachung von Zertifikat-Ablaufdaten und Verwaltung von PEM-Uploads.
- **Änderungsantrag-Workflow:** Strukturierter Prozess für die Beantragung und Genehmigung von Konfigurationsänderungen.
- **Allow-List-Publikation:** Generierung und Download von FHIR R4 Bundles und IP-Adresslisten für den produktiven DSF-Betrieb.
- **Audit und Compliance:** Nachvollziehbare Protokollierung aller Änderungen für interne und externe Prüfungen.

### 2.2 Zielgruppen

| Gruppe | Beschreibung | Zugang |
|--------|--------------|--------|
| **DSF-Teilnehmer** | IT-Administratoren und medizinisches Personal medizinischer Einrichtungen (Universitätskliniken, Forschungseinrichtungen), die eine DSF-Instanz betreiben | Über E-Mail-Whitelist eingeladen |
| **IMI-Admins** | Mitarbeiter des IMI, die Änderungsanträge prüfen und genehmigen, und die Allow List pflegen | Eigene Admin-Rolle in der Whitelist |
| **DSF-Operatoren** | Technisches Personal, das FHIR Bundles und IP-Listen für die Infrastrukturkonfiguration benötigt | Download-Endpunkte, ggf. ohne Login |

### 2.3 Betriebsbedingungen

- **Betriebsumgebung:** Containerisierter Betrieb via Docker Compose auf einem Linux-Server (Universität Münster).
- **Netzwerk:** Hinter einem nginx Reverse Proxy; SSL-Terminierung am nginx; Zugang nur über HTTPS.
- **Verfügbarkeit:** Nicht-kritische Anwendung; kein SLA für Hochverfügbarkeit. Wartungsfenster können tagsüber eingeplant werden.
- **Nutzungszeit:** Kein 24/7-Betrieb erforderlich, jedoch während der Geschäftszeiten verfügbar.
- **Benutzeranzahl:** Klein (max. 50 gleichzeitige Benutzer erwartet).
- **Browser-Support:** Aktuelle Versionen von Chrome, Firefox, Edge, Safari (Desktop).

---

## 3 Produktumgebung

### 3.1 Software

| Komponente | Technologie | Version |
|------------|-------------|---------|
| Frontend Framework | React | 18.x |
| Sprache (Frontend) | TypeScript | 5.x |
| Build-Tool | Vite | 5.x |
| Routing | React Router | 6.x |
| Server State | TanStack Query | 5.x |
| Formulare | React Hook Form + Zod | aktuell |
| UI-Komponenten | shadcn/ui + Tailwind CSS | v3 |
| Backend Framework | Express.js (Node.js) | 4.x / Node 20 LTS |
| Sprache (Backend) | TypeScript | 5.x |
| Datenbank | MySQL | 8.x |
| Cache / Session Store | Redis | 7.x |
| Auth / JWT | jsonwebtoken (RS256) | aktuell |
| TOTP | speakeasy | aktuell |
| Mail (Dev) | Mailhog | aktuell |
| Mail (Prod) | SMTP-Relay (Nodemailer) | aktuell |
| Migrationen | Knex.js | aktuell |
| API-Spezifikation | OpenAPI 3.1 | — |
| Containerisierung | Docker + Docker Compose | aktuell |
| Reverse Proxy | nginx | 1.25+ |
| FHIR | Eigene Bundle-Generierung (fhir.service.ts) | FHIR R4 |
| Excel-Export | exceljs | aktuell |

### 3.2 Hardware

| Anforderung | Minimum | Empfohlen |
|-------------|---------|-----------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Speicher | 20 GB SSD | 50 GB SSD |
| Netzwerk | 100 Mbit/s | 1 Gbit/s |
| Betriebssystem | Linux (Ubuntu 22.04 LTS) | Linux (Ubuntu 24.04 LTS) |

Client-seitig: Aktueller Desktop-Browser, Bildschirmauflösung mindestens 1280 × 800 Pixel.

---

## 4 Produktdaten

### 4.1 Datenmodell

| Entität | Primärschlüssel | Wichtige Felder | Beziehungen |
|---------|-----------------|-----------------|-------------|
| `email_whitelist` | UUID | email, created_by | — |
| `users` | UUID | email, totp_secret, totp_enabled, backup_codes, last_login | 1:n instances |
| `instances` | UUID | user_id, label | n:1 users; 1:1 organization |
| `organizations` | VARCHAR(255) (FQDN) | instance_id, name, active, email, address | n:1 instances; 1:n contacts, endpoints, certificates, memberships |
| `contacts` | UUID | organization_id, types (JSON), name, email, email_validated, phone, address | n:1 organizations |
| `endpoints` | VARCHAR(255) (FQDN) | organization_id, name, address (FHIR-URL) | n:1 organizations; 1:n endpoint_ips; 1:n memberships |
| `endpoint_ips` | UUID | endpoint_id, ip, is_fhir, is_bpe | n:1 endpoints |
| `certificates` | UUID | organization_id, pem, subject, thumbprint, valid_until | n:1 organizations |
| `memberships` | UUID | organization_id, parent_organization, endpoint_id, roles (JSON) | n:1 organizations; n:1 endpoints |
| `approval_requests` | UUID | instance_id, status, snapshot_json, resolved_by, comment | n:1 instances |
| `audit_logs` | UUID | timestamp, user_email, instance_id, resource_type, resource_id, operation, diff_json, ip_address | append-only |

**Geschätzte Datenmenge:**
- Pro Instanz: ~1 Organisation, ~5 Kontakte, ~3 Endpoints, ~6 IP-Adressen, ~3 Zertifikate, ~3 Mitgliedschaften.
- Gesamte Instanzen: max. 500 (MII-Netzwerk aktuell ~36 Standorte, Wachstum geplant).
- Audit Log: ~10.000 Einträge pro Jahr, langfristige Aufbewahrung.

### 4.2 Datenschutz

- Kontaktdaten (Name, E-Mail, Telefon, Adresse von Ansprechpartnern) werden nicht in das öffentlich verteilte Allow-List-Bundle (FHIR Bundle) eingebettet (DSGVO-Konformität, /M043/).
- PEM-Inhalte werden nie in Logs geschrieben (/M062/).
- Passwörter und Secrets werden nie geloggt.
- TOTP-Secrets werden AES-256-verschlüsselt in der Datenbank gespeichert.
- Backup-Codes werden bcrypt-gehasht gespeichert.
- Das Audit Log ist append-only – keine Löschung oder Änderung von Protokolleinträgen.
- Datenbankzugriff nur über Prepared Statements (Knex), keine String-Konkatenation in SQL.

---

## 5 Produktfunktionen

### 5.1 Authentifizierungsfunktionen

| Funktion-ID | Name | Beschreibung | Eingabe | Ausgabe |
|-------------|------|--------------|---------|---------|
| /F010/ | OTP anfordern | Benutzer gibt E-Mail ein; System prüft Whitelist und versendet OTP-Code per E-Mail | E-Mail-Adresse | Bestätigungsmeldung (generisch) |
| /F011/ | OTP verifizieren | Benutzer gibt 6-stelligen Code ein; System prüft gegen Redis-Hash | E-Mail, OTP-Code | Temp-Token oder TOTP-Setup-Redirect |
| /F012/ | TOTP einrichten | Beim ersten Login: System generiert TOTP-Secret, zeigt QR-Code an | Temp-Token | QR-Code-URL, Backup-Codes |
| /F013/ | TOTP bestätigen | Benutzer gibt ersten TOTP-Code ein um Setup abzuschließen | Temp-Token, TOTP-Code | Session-Tokens |
| /F014/ | TOTP verifizieren | Bei Folgelogins: Benutzer gibt TOTP-Code ein | Temp-Token, TOTP-Code | Session-Tokens (JWT + Refresh Cookie) |
| /F015/ | Logout | Session beenden; Refresh Token in Redis widerrufen | — | Redirect zu Login |
| /F016/ | Token-Refresh | Access Token erneuern via Refresh Token Cookie | Refresh Cookie | Neuer Access Token |
| /F017/ | Session-Restore | Nach Seiten-Neuladen: Session über Refresh Token wiederherstellen | Refresh Cookie | Aktueller Benutzerkontext |

### 5.2 Instanz- und Organisationsfunktionen

| Funktion-ID | Name | Beschreibung | Eingabe | Ausgabe |
|-------------|------|--------------|---------|---------|
| /F020/ | Instanz erstellen | Neue DSF-Instanz anlegen | Label (FQDN/UUID) | Instanz-Objekt |
| /F021/ | Instanz wechseln | Andere Instanz im Instanz-Wechsler auswählen | Instanz-ID | Alle Entitätsdaten der Instanz |
| /F030/ | Organisation anzeigen | Organisationsdaten der aktuellen Instanz laden | Instanz-ID | Organisations-Objekt |
| /F031/ | Organisation bearbeiten | Organisationsfelder editieren und speichern | Organisations-Felder | Aktualisiertes Organisations-Objekt |
| /F032/ | Abmeldungsantrag stellen | Anfrage zur Entfernung der Organisation aus der Allow List | Instanz-ID | Approval Request (PENDING) |

### 5.3 Entitäts-CRUD-Funktionen

| Funktion-ID | Entität | Operation | Besonderheit |
|-------------|---------|-----------|--------------|
| /F040/ | Kontakt | CREATE | Typen-Mehrfachauswahl (MEDIC, DSF_ADMIN, SECURITY) |
| /F041/ | Kontakt | READ LIST | Alle Kontakte der Organisation |
| /F042/ | Kontakt | UPDATE | Alle Felder editierbar |
| /F043/ | Kontakt | DELETE | Löschen mit Bestätigungsdialog |
| /F044/ | Kontakt | Verifikations-Mail | E-Mail-Verifikation erneut versenden |
| /F050/ | Endpoint | CREATE | IP-Adressen-Liste mit Flags |
| /F051/ | Endpoint | READ LIST | Alle Endpoints der Organisation inkl. IPs |
| /F052/ | Endpoint | UPDATE | Alle Felder und IP-Adressen editierbar |
| /F053/ | Endpoint | DELETE | Löschen; FK-Check auf Mitgliedschaften |
| /F060/ | Zertifikat | UPLOAD | PEM parsen, Private-Key-Rejection, Metadaten-Extraktion |
| /F061/ | Zertifikat | READ LIST | Alle Zertifikate mit Ablaufdatum und Warn-Banner |
| /F062/ | Zertifikat | DELETE | Löschen mit Bestätigungsdialog |
| /F070/ | Mitgliedschaft | CREATE | Parent-Org, Endpoint-Auswahl, Rollen-Mehrfachauswahl |
| /F071/ | Mitgliedschaft | READ LIST | Alle Mitgliedschaften der Organisation |
| /F072/ | Mitgliedschaft | UPDATE | Alle Felder editierbar |
| /F073/ | Mitgliedschaft | DELETE | Löschen mit Bestätigungsdialog |
| F086 | Admin-Review-Seite | Dedizierte Seite für IMI-Admins mit expandierbarem Snapshot-Viewer |
| F087 | TOTP-Re-Bestätigung | Authenticator-Code erforderlich vor Approve/Reject |

### 5.4 Approval- und Download-Funktionen

| Funktion-ID | Name | Beschreibung | Eingabe | Ausgabe |
|-------------|------|--------------|---------|---------|
| /F080/ | Änderungsantrag einreichen | Aktuellen Daten-Snapshot einfrieren und zur Prüfung einreichen | Instanz-ID | Approval Request (PENDING) |
| /F081/ | Antragsstatus abrufen | Aktuellen Approval-Status der Instanz anzeigen | Instanz-ID | Status-Objekt |
| /F082/ | Antragshistorie abrufen | Alle vergangenen Approval Requests einer Instanz | Instanz-ID | Liste von Approval-Requests |
| /F083/ | Antrag genehmigen (Admin) | IMI-Admin genehmigt einen ausstehenden Antrag | Request-ID | Status → APPROVED |
| /F084/ | Antrag ablehnen (Admin) | IMI-Admin lehnt Antrag ab mit Kommentar | Request-ID, Kommentar | Status → REJECTED |
| /F090/ | FHIR Bundle downloaden | FHIR R4 Bundle für eine Instanz generieren | Instanz-ID, (Endpoint-ID optional) | JSON-Datei |
| /F091/ | IP-Adressliste exportieren | Alle Endpoint-IPs als Excel-Datei exportieren | — | .xlsx-Datei |

### 5.5 Audit- und Canvas-Funktionen

| Funktion-ID | Name | Beschreibung | Eingabe | Ausgabe |
|-------------|------|--------------|---------|---------|
| /F100/ | Audit Log anzeigen | Paginiertes Audit Log für eine Instanz | Instanz-ID, Filter, Seite | Audit-Einträge |
| /F101/ | Audit Log filtern | Einträge nach Ressourcentyp und Operation filtern | Filter-Parameter | Gefilterte Einträge |
| /F110/ | Entity-Graph-Canvas rendern | Alle Entitätskarten gleichzeitig im 3-Spalten-Layout darstellen | Instanz-ID | Gerenderte Canvas-UI |
| /F111/ | SVG-Relationslinien zeichnen | Bezier-Kurven zwischen verbundenen Entitäten einzeichnen | DOM-Positionen der Cards | SVG-Overlay |
| /F112/ | FK-Highlight aktivieren | Beim Hovern verwandte Entitäten hervorheben | Hover-Event | Visuelles Highlight |
| F118 | Admin Review Page | Tabelle ausstehender Requests mit Approve/Reject + TOTP-Eingabe |
| F119 | Logout | Sign-out-Button in der Sidebar mit Session-Invalidierung |

---

## 6 Qualitätsanforderungen

| Qualitätsmerkmal | Untermerkmal | Anforderung | Messgröße |
|------------------|--------------|-------------|-----------|
| **Funktionalität** | Korrektheit | Alle CRUD-Operationen produzieren konsistente Datenbankzustände | 0 Datenkonsistenzfehler in Tests |
| **Funktionalität** | Sicherheit | Private Keys dürfen nie gespeichert oder geloggt werden | Statische Code-Analyse; kein PEM-Log in Testlauf |
| **Zuverlässigkeit** | Fehlertoleranz | Ein fehlgeschlagener Audit-Log-Eintrag darf die eigentliche Operation nicht blockieren | Alle Operationen laufen bei simuliertem Audit-Fehler durch |
| **Zuverlässigkeit** | Wiederherstellbarkeit | Sessions werden nach Seiten-Neuladen automatisch wiederhergestellt | Session-Restore-Test: < 500 ms |
| **Benutzbarkeit** | Verständlichkeit | Alle Entitäten und Relationen auf einem Blick erkennbar | Kein Tab-Switching erforderlich |
| **Benutzbarkeit** | Bedienbarkeit | Formulare validieren inline und zeigen verständliche Fehlermeldungen | Kein leeres Submit ohne Fehlermeldung möglich |
| **Effizienz** | Zeitverhalten | Initiales Laden der App (alle Entitäten einer Instanz) | < 2 Sekunden bei LAN-Verbindung |
| **Effizienz** | Zeitverhalten | API-Antwortzeiten unter normaler Last | p95 < 200 ms |
| **Wartbarkeit** | Analysierbarkeit | Audit Log ermöglicht vollständige Nachverfolgung aller Änderungen | 100 % der schreibenden Operationen geloggt |
| **Wartbarkeit** | Änderbarkeit | Kein `any`-Typ in TypeScript; klare Schichttrennung | TypeScript strict mode; 0 `any`-Vorkommen |
| **Übertragbarkeit** | Installierbarkeit | Vollständige Umgebung per `docker compose up` startbar | Keine manuellen Schritte außer `.env` befüllen |
| **Sicherheit** | Vertraulichkeit | Alle Kommunikation über HTTPS | SSL-Zertifikat aktiv; HTTP → HTTPS-Redirect |
| **Sicherheit** | Integrität | JWT mit RS256 signiert; keine HS256-Nutzung | Automatisierter Algorithmus-Check |
| **Sicherheit** | Nicht-Abstreitbarkeit | Audit Log append-only; kein DELETE/UPDATE auf `audit_logs` | DB-Constraint oder Anwendungslogik |

---

## 7 Benutzeroberfläche

### 7.1 Layout-Übersicht

```
+------------------------------------------------------------------+
|  LOGO   DSF Allow List Management Portal      [Env: TEST] [User] |
+--------+---------------------------------------------------------+
|        |                                                         |
| Side-  |  ENTITY GRAPH CANVAS (3-Spalten-Grid)                  |
| bar    |                                                         |
|        |  +------------------+  +------------------+  +-------+ |
| [Inst. |  |  ORGANISATION    |  |  ENDPOINTS       |  | MITGL.|
| Swit-  |  |  ─────────────── |  |  ─────────────── |  | SCHAFT|
| cher]  |  |  Name, FQDN,     |  |  [Endpoint 1]    |  |       |
|        |  |  Adresse, ...    |  |  └ IPs: ...      |  | [+]   |
| [Inst. |  |  [✎ Bearbeiten]  |  |  [Endpoint 2]    |  |       |
|  1   ] |  +------------------+  |  [+]             |  +-------+
| [Inst. |         |  SVG-Linie   +------------------+      |     |
|  2   ] |         |  (Bezier)         |   SVG-Linie        |     |
| [+Neu] |  +------------------+  +------------------+  +-------+ |
|        |  |  KONTAKTE        |  |  ZERTIFIKATE     |  | APPRO-|
| ─────  |  |  ─────────────── |  |  ─────────────── |  | VAL   |
|        |  |  [Kontakt 1]     |  |  [Zert. 1]  ⚠️   |  |       |
| [Audit]|  |  [Kontakt 2]     |  |  [Zert. 2]       |  | STAT: |
| [Down] |  |  [+]             |  |  [+]             |  | PEND. |
|        |  +------------------+  +------------------+  +-------+ |
| ─────  |                                                         |
| [User] |         SVG OVERLAY (absolut positioniert)              |
| [Logout         Bezier-Relationslinien zwischen Cards            |
+--------+---------------------------------------------------------+
```

**Bildschirmbereiche:**

1. **Header:** Logo, Portalname, Umgebungsindikator (TEST/PROD mit Farbcodierung), Benutzeridentität.
2. **Sidebar (links):** Instanz-Wechsler, Navigationslinks (Audit, Download), Benutzer-Identitätsanzeige, Logout-Button.
3. **Entity-Graph-Canvas (Mitte/Hauptbereich):** 3-Spalten-Grid mit 6 Entitätskarten; SVG-Overlay für Relationslinien.
4. **Karten (Cards):** Jede Karte zeigt eine Entitätsliste mit Inline-Edit-Aktionen und einem "+ Hinzufügen"-Button.

### 7.2 Designrichtlinien

- **Design-System:** shadcn/ui Komponenten auf Basis von Tailwind CSS v3.
- **Farbschema:** Helles Design (Light Mode); Primärfarbe: neutrales Blau/Grau gemäß shadcn-Defaults; Umgebungsfarbe (TEST: `#63C7A6`, PROD: konfigurierbar) als farbiger Badge im Header.
- **Typografie:** System-Font-Stack; klare Hierarchie durch Schriftgewichte.
- **Relationslinien:** SVG-Bezier-Kurven in gedeckter Akzentfarbe; bei FK-Highlight leuchtend/kräftig; sonst transparent/gedimmt.
- **Modals:** Alle 7 Formulare erscheinen als Modal-Dialog; kein Routing in separate Seiten.
- **Feedback:** Inline-Validierungsfehler direkt unter Formularfeldern; Toast-Notifications oben rechts für globale Erfolgs-/Fehlermeldungen.
- **Warn-Banner:** Zertifikate nahe Ablauf oder abgelaufen erhalten eine gelbe/rote Badge und ein kontextuelles Warn-Banner auf der Karte.
- **Leerszustände:** Jede Karte zeigt einen aussagekräftigen Empty State mit Handlungsaufforderung, wenn keine Einträge vorhanden sind.

---

## 8 Nichtfunktionale Anforderungen

### 8.1 Sicherheit

| Anforderung | Detail |
|-------------|--------|
| HTTP-Security-Headers | Helmet.js auf allen Express-Routen: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| CORS | Nur eigene Domain erlaubt; keine Wildcards (`*`) |
| Cookies | httpOnly, Secure, SameSite=Strict |
| JWT-Algorithmus | RS256 (asymmetrisch); HS256 ist verboten |
| SQL-Injection | Ausschließlich Prepared Statements via Knex; keine String-Konkatenation in SQL |
| Private-Key-Upload | Bei Erkennung eines PRIVATE KEY im PEM-Body: sofortiger HTTP 400; kein Logging des PEM-Inhalts |
| DSGVO-Compliance | Kontaktdaten nicht im öffentlichen Allow-List-Bundle; minimale Datenspeicherung |
| Audit-Integrität | Kein UPDATE oder DELETE auf der `audit_logs`-Tabelle erlaubt |
| Secrets-Management | Alle Secrets ausschließlich über Umgebungsvariablen; keine Hardcoding; `.env` in `.gitignore` |
| Rate Limiting | Redis-backed; separates Limit für Auth-Routen (5/15 min) und API-Routen (100/min) |
| Session-Sicherheit | Refresh Tokens in Redis revocable; Logout invalidiert sofort alle Sessions |

### 8.2 Leistung

| Anforderung | Zielwert |
|-------------|----------|
| Initiales App-Laden (alle Entitäten) | < 2 Sekunden (LAN) |
| API-Antwortzeit (p95) | < 200 ms |
| FHIR-Bundle-Generierung | < 5 Sekunden |
| Excel-Export (IP-Liste) | < 3 Sekunden |
| SVG-Neuberechnung bei Resize | < 50 ms (requestAnimationFrame) |
| Maximale gleichzeitige Benutzer | 50 ohne Degradation |
| Redis-Session-Lookup | < 5 ms |
| Datenbankabfragen (einfache Reads) | < 10 ms |

---

## 9 Testfälle

| Test-ID | Testfall | Vorbedingung | Testschritte | Erwartetes Ergebnis |
|---------|----------|--------------|--------------|---------------------|
| /T010/ | OTP-Anfrage mit nicht-whitelisted E-Mail | E-Mail nicht in `email_whitelist` | POST /auth/request-otp mit fremder E-Mail | HTTP 200 mit generischer Meldung; kein OTP versendet; kein Hinweis auf Nichtexistenz |
| /T011/ | OTP-Anfrage mit whitelisted E-Mail | E-Mail in `email_whitelist` | POST /auth/request-otp mit gültiger E-Mail | HTTP 200; OTP-Code per E-Mail versandt; Code in Redis gespeichert |
| /T012/ | OTP-Verifikation mit falschem Code | Gültiger OTP in Redis | POST /auth/verify-otp mit falschem Code | HTTP 401; Versuchszähler erhöht |
| /T013/ | OTP-Verifikation mit korrektem Code (kein TOTP) | Gültiger OTP, kein TOTP eingerichtet | POST /auth/verify-otp mit korrektem Code | HTTP 200; Redirect zu TOTP-Setup; OTP aus Redis gelöscht |
| /T014/ | Rate Limit auf OTP-Route | — | 6 POST /auth/request-otp in < 15 min von gleicher IP | 6. Anfrage: HTTP 429 Too Many Requests |
| /T020/ | TOTP-Setup abschließen | Temp-Token nach OTP-Verifikation | POST /auth/setup-totp → QR anzeigen → POST /auth/confirm-totp mit korrektem Code | HTTP 200; Session-Tokens ausgegeben; TOTP aktiviert |
| /T021/ | TOTP-Verifikation mit falschem Code | TOTP eingerichtet | POST /auth/verify-totp mit falschem Code | HTTP 401 |
| /T022/ | Backup-Code verwenden | TOTP eingerichtet; Backup-Code bekannt | POST /auth/verify-totp mit Backup-Code | HTTP 200; Backup-Code als verwendet markiert |
| /T030/ | Private Key im PEM-Upload ablehnen | Authentifiziert | POST /certificates mit PEM enthält PRIVATE KEY | HTTP 400; kein Datenbankeintrag; kein Logging des PEM-Inhalts |
| /T031/ | Gültiges Zertifikat hochladen | Authentifiziert | POST /certificates mit gültigem X.509-PEM | HTTP 201; Metadaten (Subject, Thumbprint, valid_until) korrekt extrahiert |
| /T032/ | Ablaufwarnung für Zertifikat | Zertifikat mit valid_until < 30 Tage | GET /certificates | Warn-Flag in Response; Warn-Banner in UI sichtbar |
| /T040/ | Kontakt anlegen mit ungültiger E-Mail | Authentifiziert | POST /contacts mit malformed E-Mail | HTTP 400; Validierungsfehler in Response |
| /T041/ | Kontakt löschen | Kontakt vorhanden | DELETE /contacts/:id | HTTP 200; Kontakt nicht mehr in Liste |
| /T050/ | Approval Request einreichen | Instanz mit vollständigen Daten | POST /approval/submit | HTTP 201; Status PENDING; Snapshot-JSON gespeichert |
| /T051/ | Admin genehmigt Antrag | Antrag PENDING; Admin-Rolle | POST /admin/approval/:id/approve | HTTP 200; Status APPROVED |
| /T052/ | Nicht-Admin kann Antrag nicht genehmigen | Antrag PENDING; normaler User | POST /admin/approval/:id/approve | HTTP 403 Forbidden |
| /T060/ | FHIR Bundle enthält keine Kontaktdaten | Instanz mit Kontakten | GET /download/bundle | JSON-Response enthält keine E-Mail/Telefon von Kontakten |
| /T070/ | Audit Log wird geschrieben | Authentifiziert | PUT /organization (Update) | Audit-Log-Eintrag mit Operation UPDATE, resource_type ORGANIZATION vorhanden |
| /T071/ | Audit Log nicht veränderbar | — | UPDATE/DELETE auf `audit_logs` via API | HTTP 405 / nicht möglich; Testfall auf DB-Ebene |
| /T080/ | Session nach Neuladen wiederhergestellt | Aktive Session mit Refresh Cookie | Seite neu laden | App zeigt sofort eingeloggten Zustand ohne Login-Redirect |
| /T081/ | Logout widerruft Refresh Token | Aktive Session | POST /auth/logout; danach POST /auth/refresh | HTTP 401 auf Refresh nach Logout |
| T080 | TOTP-Re-Bestätigung bei Approve | Approve ohne TOTP-Code → HTTP 400 TOTP_REQUIRED |
| T081 | TOTP-Re-Bestätigung bei Reject | Reject ohne TOTP-Code → HTTP 400, mit falschem Code → HTTP 401 |
| T082 | E-Mail an Admins bei Submit | Neuer Request → E-Mail an alle IMI_ADMIN_EMAILS innerhalb 1 Minute |
| T083 | Verzögerte E-Mail an Standort | Approve → Standort-Kontakte erhalten E-Mail nach 30 Minuten |

---

## 10 Glossar

| Begriff | Definition |
|---------|------------|
| **Allow List** | Zentrales Verzeichnis aller zugelassenen DSF-Teilnehmer mit technischen und organisatorischen Daten |
| **Approval Request** | Formeller Änderungsantrag eines DSF-Teilnehmers, der durch einen IMI-Admin geprüft und genehmigt oder abgelehnt wird |
| **AMS** | Allowlisting Management System – eine der möglichen DSF-Rollen einer Mitgliedschaft |
| **Backup-Code** | Einmalig verwendbarer Wiederherstellungscode als Alternative zu TOTP bei verlorenem Authenticator |
| **BPE** | Business Process Engine – Komponente im DSF; Endpoint-IP-Flag `is_bpe` kennzeichnet IPs für BPE-Traffic |
| **Canvas** | Der Hauptbereich der UI, auf dem alle Entitätskarten gleichzeitig sichtbar und interaktiv sind |
| **DIC** | Data Integration Center – eine der möglichen DSF-Rollen einer Mitgliedschaft |
| **DMS** | Data Management System – eine der möglichen DSF-Rollen einer Mitgliedschaft |
| **DSF** | Data Sharing Framework – technische Infrastruktur für den sicheren Datenaustausch in medizinischen Forschungsnetzen |
| **DSGVO** | Datenschutz-Grundverordnung – EU-Verordnung zum Schutz personenbezogener Daten |
| **Entity-Graph** | Visuelle Darstellung aller Entitäten und ihrer Beziehungen als interaktiver Graph auf einem einzigen Canvas |
| **FHIR** | Fast Healthcare Interoperability Resources – HL7-Standard für den Austausch medizinischer Daten |
| **FHIR Bundle** | Zusammenstellung mehrerer FHIR-Ressourcen in einem JSON-Dokument; hier: Allow-List-Paket einer Instanz |
| **FK-Highlight** | Visuelles Hervorheben von Entitätskarten, die über einen Fremdschlüssel mit der hovered Karte verbunden sind |
| **FQDN** | Fully Qualified Domain Name – vollständiger Domainname, z.B. `ukm.de` oder `fhir.ukm.de` |
| **IMI** | Institute of Medical Informatics Muenster; Betreiber des DSF Allow List Management Portals an der Universität Münster |
| **HRP** | High-Level Routing Platform – eine der möglichen DSF-Rollen einer Mitgliedschaft |
| **httpOnly Cookie** | Browser-Cookie, das nicht per JavaScript ausgelesen werden kann; erhöht Session-Sicherheit |
| **Instanz** | Repräsentation einer DSF-Installation (einer Einrichtung) im Portal; enthält alle zugehörigen Entitäten |
| **JWT** | JSON Web Token – signiertes Token zur Authentifizierung und Autorisierung |
| **Knex.js** | SQL-Query-Builder für Node.js; wird für Datenbankzugriff und Migrationen verwendet |
| **MII** | Medizininformatik-Initiative – deutsches Forschungsprogramm zur Vernetzung medizinischer Daten |
| **NUM** | Netzwerk Universitätsmedizin – nationales Forschungsnetzwerk während und nach COVID-19 |
| **OTP** | One-Time Password – einmaliger, zeitlich begrenzter Zugangscode; hier per E-Mail versandt |
| **PEM** | Privacy Enhanced Mail – Base64-kodiertes Format für Zertifikate und Schlüssel |
| **Rate Limiting** | Mechanismus zur Begrenzung der Anfragehäufigkeit pro IP-Adresse/Benutzer zur Missbrauchsverhinderung |
| **Redis** | In-Memory-Datenspeicher; hier für OTP-Hashes, Refresh Tokens und Rate-Limit-Zähler genutzt |
| **RS256** | RSA-Signatur mit SHA-256 – asymmetrisches Signaturverfahren für JWTs |
| **Session Restore** | Automatische Wiederherstellung einer aktiven Session nach Seiten-Neuladen ohne erneuten Login |
| **Snapshot** | Vollständiger Datenzustand einer Instanz zum Zeitpunkt der Einreichung eines Approval Requests |
| **SVG** | Scalable Vector Graphics – XML-basiertes Vektorgrafikformat; hier für Relationslinien im Canvas |
| **TOTP** | Time-based One-Time Password – zeitbasierter Einmalcode über Authenticator-App (z.B. Google Authenticator) |
| **Whitelist** | Liste zugelassener E-Mail-Adressen; nur eingetragene Adressen können sich am Portal anmelden |
| **X.509** | Standard für digitale Zertifikate; definiert das Format für PKI-Zertifikate |
