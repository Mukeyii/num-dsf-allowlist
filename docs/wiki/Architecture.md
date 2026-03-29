# Architecture

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| State | TanStack Query v5 + Zustand |
| Forms | React Hook Form + Zod |
| UI | Tailwind CSS v3 + inline styles |
| Backend | Node.js + Express + TypeScript |
| Database | MySQL 8 (Knex query builder) |
| Cache | Redis 7 |
| Auth | JWT (RS256) + OTP + TOTP |
| Email | Nodemailer (Mailhog in dev) |
| Proxy | nginx |
| Containers | Docker + Docker Compose |

## System Diagram

```
┌─────────┐     ┌──────────┐     ┌─────────┐
│  nginx  │────▶│ frontend │     │ Mailhog │
│  :80    │     │  :5173   │     │  :8025  │
│         │────▶│          │     └─────────┘
│         │     └──────────┘         ▲
│         │                          │
│         │────▶┌──────────┐    ┌────┴────┐
│         │     │ backend  │───▶│  SMTP   │
│         │     │  :3000   │    │  :1025  │
└─────────┘     │          │    └─────────┘
                │          │
          ┌─────┴────┐  ┌──┴───┐
          │  MySQL   │  │Redis │
          │  :3306   │  │:6379 │
          └──────────┘  └──────┘
```

## Data Model

The portal manages 5 interconnected entities per instance:

- **Organization** (1 per instance) — the DSF participant
- **Contacts** (N per org) — MEDIC, DSF_ADMIN, SECURITY contacts
- **Endpoints** (N per org) — FHIR server URLs with IP addresses
- **Certificates** (N per org) — X.509 certs with thumbprints
- **Memberships** (N per org) — affiliations with parent orgs and roles

## FHIR Bundle Format

The portal generates DSF-compliant FHIR R4 transaction bundles containing:
- `Organization` resources with certificate thumbprint extensions
- `Endpoint` resources with FHIR connection type
- `OrganizationAffiliation` resources with member role codes

All resources use `urn:uuid:` references and conditional PUT requests.
