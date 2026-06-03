# DSF Management Portal

A web application for managing participants in the **Data Sharing Framework (DSF)** of the German Medical Informatics Initiative (MII/NUM).

## Features

- **Entity Graph Canvas** — All 5 entities (Organization, Contacts, Endpoints, Certificates, Memberships) visible and editable on a single screen
- **Passwordless Auth** — Email OTP + TOTP 2FA, no passwords
- **Approval Workflow** — Submit changes for IMI admin review (4-eyes) with TOTP re-confirmation
- **FHIR R4 Bundles** — DSF-compliant transaction bundles with RS256 signing
- **Bundle Versioning** — Every approval snapshots the federation bundle for diff, download, and restore
- **mTLS Authentication** — DSF processes authenticate via client certificates
- **Certificate Management** — Upload, renewal wizard, expiry tracking and alerts
- **CA Blacklist** — Reject certificate uploads issued by distrusted CAs
- **Network Map** — Federation-wide allow list as an interactive Germany silhouette
- **Process Marketplace** — Curated DSF process catalog
- **Append-only Audit Log** — Tamper-evident operations history (DB-level triggers)
- **Dark Mode** — Blue-tinted dark palette with modern scrollbars
- **DE/EN** — German and English interface

## Quick Links

- [Getting Started](Getting-Started) — Setup with Docker Compose
- [Architecture](Architecture) — Tech stack and system design
- [API Reference](API-Reference) — All endpoints with examples
- [Security](Security) — Authentication, encryption, GDPR
- [Admin Guide](Admin-Guide) — Approval workflow and administration
- [FAQ](FAQ) — Common questions and troubleshooting
- [Architecture Decisions](https://github.com/Mukeyii/num-dsf-allowlist/tree/main/docs/adr) — ADRs (RS256, 4-eyes, mTLS, audit immutability, …)
- [Database](https://github.com/Mukeyii/num-dsf-allowlist/tree/main/docs/database) — Schema, ERD, migrations, Redis keys, retention
