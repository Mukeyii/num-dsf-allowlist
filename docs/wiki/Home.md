# DSF Management Portal

A web application for managing participants in the **Data Sharing Framework (DSF)** of the German Medical Informatics Initiative (MII/NUM).

## Features

- **Entity Graph Canvas** — All 5 entities (Organization, Contacts, Endpoints, Certificates, Memberships) visible and editable on a single screen
- **Passwordless Auth** — Email OTP + TOTP 2FA, no passwords
- **Approval Workflow** — Submit changes for IMI admin review with TOTP re-confirmation
- **FHIR R4 Bundles** — DSF-compliant transaction bundles with RS256 signing
- **mTLS Authentication** — DSF processes authenticate via client certificates
- **Dark Mode** — Blue-tinted dark palette with modern scrollbars
- **DE/EN** — German and English interface
- **Certificate Management** — Upload, renewal wizard, expiry tracking and alerts

## Quick Links

- [Getting Started](Getting-Started) — Setup with Docker Compose
- [Architecture](Architecture) — Tech stack and system design
- [API Reference](API-Reference) — All endpoints with examples
- [Security](Security) — Authentication, encryption, GDPR
- [Admin Guide](Admin-Guide) — Approval workflow and administration
- [FAQ](FAQ) — Common questions and troubleshooting
