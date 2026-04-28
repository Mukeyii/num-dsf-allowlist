# Pflichtenheft — DSF Allow List Management Portal

**Stand:** 2026-04-27
**Betreiber:** Institute of Medical Informatics (IMI), Universität Münster
**Hauptentwickler:** Kemal Yildirim

---

## 1. Zweck und Geltungsbereich

Das Portal verwaltet ein zentrales Verzeichnis aus fünf miteinander verknüpften Entitäten (Organization, Contacts, Endpoints, Certificates, Memberships) für Teilnehmer am Data Sharing Framework (DSF) der Medizininformatik-Initiative (MII) und des Netzwerks Universitätsmedizin (NUM). Die Allow-List wird als RS256-signiertes FHIR-Bundle an angeschlossene DSF-FHIR-Server ausgeliefert.

## 2. Akteure

- **Site-User** — verwaltet die Daten genau einer Instanz (eigene Organisation).
- **IMI-Admin** — prüft Anträge im 4-Augen-Prinzip; darf alle Instanzen einsehen und unterstützend bearbeiten; kann sich per Client-Zertifikat anmelden.
- **DSF-BPE-Prozess** — maschineller Konsument der Allow-List; authentisiert via mTLS am Endpoint `/fhir/Bundle/:endpointId`.

## 3. Funktionale Anforderungen

### 3.1 Authentifizierung
- F-AUTH-01: Login per E-Mail-Whitelist + 6-stelligem OTP (10-Min-TTL, einmalig verwendbar).
- F-AUTH-02: Zweiter Faktor TOTP (RFC 6238, 30-s-Fenster, max. 1 Step Drift).
- F-AUTH-03: 10 Backup-Codes pro Konto, bcrypt-gehasht, einmalig verwendbar.
- F-AUTH-04: Optionaler Client-Zertifikats-Login (`POST /auth/client-cert-login`) gegen `organizations.client_cert_thumbprint` (SHA-256 über DER).
- F-AUTH-05: Sessions: RS256 JWT (15 Min), httpOnly Refresh-Cookie (7 Tage), revoke-bar.

### 3.2 Entitätenverwaltung
- F-ENT-01: Fünf Entitäten — Organization, Contacts, Endpoints, Certificates, Memberships.
- F-ENT-02: Alle Entitäten gleichzeitig auf einer Seite (Entity-Graph-Canvas) mit SVG-Verbindungslinien.
- F-ENT-03: PEM-Upload bei Zertifikaten lehnt private Schlüssel an der Grenze ab (HTTP 400) und loggt sie nie.
- F-ENT-04: Frontend-Validierung via Zod; Backend-Validierung deckungsgleich.
- F-ENT-05: FQDN-Validierung folgt RFC 1123 (Multi-Label, Mixed Case, optionaler Trailing-Dot).

### 3.3 Approval-Workflow (Vier-Augen-Prinzip)
- F-APPR-01: Site-User reicht Antrag ein → Status `PENDING`, Snapshot in `approval_requests.snapshot_json`.
- F-APPR-02: Alle IMI-Admins werden bei Eingang per E-Mail benachrichtigt.
- F-APPR-03: Pro Antrag werden Signaturen in der Tabelle `approval_signatures` gespeichert.
- F-APPR-04: Genehmigung erfordert zwei `APPROVE`-Signaturen aus unterschiedlichen Sites (E-Mail-Domains).
- F-APPR-05: Bei der ersten Genehmigung wird der zweite Admin per E-Mail informiert.
- F-APPR-06: Schweigen-als-Zustimmung: liegt nach `APPROVAL_SILENT_CONSENT_DAYS` (Default 7) keine Ablehnung vor, wird der Antrag automatisch genehmigt (`resolved_by = SYSTEM:silent-consent`).
- F-APPR-07: Eine einzelne Ablehnung schließt den Antrag sofort ab.

### 3.4 Cross-Instance-Zugriff durch Admins
- F-XAD-01: Admins können fremde Instanzen laden; ein persistentes Banner zeigt den Eigentümer.
- F-XAD-02: Speichern auf einer fremden Instanz öffnet einen Bestätigungsdialog vor dem Mutationsaufruf.
- F-XAD-03: `client_cert_thumbprint` kann von Admins auf fremden Instanzen NICHT gesetzt werden (Sicherheits-Gate gegen Identity-Laundering).

### 3.5 Bundle-Download
- F-BND-01: GUI-Download als JSON über `/api/v1/download/full-bundle` (für authentifizierte Nutzer, kein Instanz-Scope). Liefert das **netzwerkweite** Allow-List-Bundle: alle genehmigten Organisationen mit Endpoints, Zertifikats-Thumbprints und OrganizationAffiliations zu Verbünden (MII, NUM).
- F-BND-02: Maschinen-Download über `/fhir/Bundle?identifier=http://dsf.dev/fhir/CodeSystem/allow-list|allow_list` mit mTLS-Authentifizierung; identische Bundle-Form wie F-BND-01. Bundle ist RS256-signiert (`X-Bundle-Signature` Header), Inhalt SHA-256-gehasht (`X-Content-Hash` Header).
- F-BND-03: Excel-Export der IP-Adressen über `/api/v1/download/ip-address-list`.
- F-BND-04: DSGVO: Kontaktdaten dürfen NIEMALS im Allow-List-Bundle erscheinen.
- F-BND-05: Bundle-Form folgt exakt dem Upstream-Vertrag von `dsf-process-allow-list/UpdateAllowList` — Identifier `http://dsf.dev/fhir/CodeSystem/allow-list|allow_list`, Transaktion-Bundle mit Organization-, Endpoint- und OrganizationAffiliation-Resourcen.
- F-BND-06: Federation-Safety. Tool emittiert ausschließlich `DELETE` auf `OrganizationAffiliation`, nie auf `Organization` oder `Endpoint`. Stamm-Records werden bei Verbund-Austritt nicht entfernt — sie bleiben am Empfänger inert liegen, falls andere Tools sie weiter listen. Soft-deletete Memberships werden 90 Tage aufbewahrt (cron-cleanup), damit alle Standorte mindestens einen Bundle-Roundtrip durchgemacht haben, bevor die Aufbewahrungs-Zeile hart gelöscht wird.

### 3.6 Audit-Log
- F-AUD-01: Append-only `audit_logs` Tabelle; kein UPDATE/DELETE auf Anwendungsebene.
- F-AUD-02: Audit-Seite ist instanz-übergreifend und zeigt pro Eintrag den Instanz-Kontext (Label, Organisation).
- F-AUD-03: Jede Auth-Aktion, jede Entitäts-Mutation, jede Approval-Entscheidung wird geloggt.

### 3.7 Netzwerkkarte
- F-MAP-01: Schematische Deutschland-Karte zeigt alle approved Organisationen.
- F-MAP-02: Multi-Site-Städte werden zu Cluster-Pins zusammengefasst.
- F-MAP-03: Verbund-Edges (MII, NUM) werden aus `parent_organization` abgeleitet.
- F-MAP-04: Filter: Verbund, Cert-Status, Stadt, aktiv/inaktiv.
- F-MAP-05: Kartendarstellung ist Theme-aware (Light/Dark Mode); im Dark Mode invertierte Schiefer-Palette.
- F-MAP-06: Linker Rail zeigt alle Organisationen gruppiert nach `parent_organization`.

### 3.8 Internationalisierung
- F-I18N-01: UI vollständig zweisprachig DE/EN; Sprachumschaltung in der TopBar.
- F-I18N-02: Alle benutzersichtbaren Strings durchlaufen `t(key, params?)`.

### 3.9 Admin-Hilfe
- F-HELP-01: Admin-Referenzseite unter `/app/admin/help` mit Abschnitten zu Approval, Cross-User-Bearbeitung, Audit, Bundle-Download, Zertifikaten, mTLS und Support.
- F-HELP-02: Footer auf jeder Seite zeigt Entwickler-Attribution und Affiliation.

## 4. Nicht-funktionale Anforderungen

- NF-SEC-01: Helmet.js, CSP, HSTS, X-Frame-Options auf allen Express-Routen.
- NF-SEC-02: Rate-Limiting: 5 req / 15 min für Auth-Endpoints, 100 req / Min für API.
- NF-SEC-03: SQL ausschließlich via Knex Prepared Statements.
- NF-SEC-04: Cookies: `httpOnly`, `secure`, `sameSite=strict`.
- NF-SEC-05: JWT RS256 (asymmetrisch); HS256 verboten.
- NF-SEC-06: Audit-Log-Failures dürfen die eigentliche Operation nicht blockieren.
- NF-SEC-07: nginx HTTPS-Block setzt `proxy_set_header X-Client-Cert $ssl_client_escaped_cert`; HTTP-Vhost überschreibt eingehende `X-Client-Cert` Header mit Leerstring.
- NF-PERF-01: Map-Page rendert 200 Pins ohne wahrnehmbare Verzögerung.
- NF-OPS-01: Konfiguration ausschließlich über Umgebungsvariablen; keine Secrets im Code.
- NF-OPS-02: Drei tägliche Cron-Jobs: 06:00 UTC Approval-Reminders, 07:00 UTC Silent-Consent, 08:00 UTC Cert-Expiry-Check.

## 5. Datenmodell

Migrationen: `db/migrations/*.sql`. Wichtigste Tabellen:

- `users`, `email_whitelist`
- `instances`
- `organizations`, `contacts`, `endpoints`, `endpoint_ips`, `certificates`, `memberships`
- `approval_requests`, `approval_signatures`
- `audit_logs`

## 6. Schnittstellen

- REST-API gemäß OpenAPI 3.1 (siehe Backend-Routen).
- Externe Schnittstelle: DSF-FHIR-Server (mTLS, FHIR Bundle).

## 7. Abnahmekriterien

- Backend-Tests (`jest + supertest`): Auth, CRUD pro Entität, Approval-Workflow inkl. 4-Augen-Prinzip + Silent-Consent.
- Frontend-Tests (`vitest`): Validierungs-Schemas, Hilfsfunktionen, Komponenten.
- Mindestabdeckung: Jede F-Anforderung in §3 hat mindestens eine grüne Test-Spezifikation.

## 8. Entwickler

**Hauptentwickler:** Kemal Yildirim
**Affiliation:** Institute of Medical Informatics, Universität Münster
**Kontakt:** über das IMI-Betriebsteam
