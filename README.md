# DSF Allow List Management Portal

A web application for managing participants in the **Data Sharing Framework (DSF)** of the German Medical Informatics Initiative (MII/NUM). Operated by the Institute of Medical Informatics Muenster (IMI) at the University of Muenster.

## Overview

The portal manages a central directory of five interconnected entities:

- **Organizations** — Healthcare institutions participating in the DSF network
- **Contacts** — Responsible persons per organization (MEDIC, DSF_ADMIN, SECURITY)
- **Endpoints** — DSF FHIR endpoints with associated IP addresses
- **Certificates** — X.509 certificates for secure communication
- **Memberships** — Organizational affiliations and roles (DIC, HRP, DMS, AMS)

All entities are displayed simultaneously on an interactive entity-graph canvas with SVG relation lines — no tab switching, no page navigation. Everything is visible and editable on a single screen.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Routing | React Router v6 |
| Server State | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| UI | shadcn/ui + Tailwind CSS v3 |
| Backend | Node.js + Express + TypeScript |
| Database | MySQL 8 |
| Auth | Passwordless (OTP + TOTP 2FA) |
| Sessions | JWT (RS256) + Refresh Token (Redis) |
| Cache/Rate Limiting | Redis 7 |
| Email | Nodemailer (Mailhog in dev) |
| Reverse Proxy | nginx |
| Containers | Docker + Docker Compose |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+)
- [Node.js](https://nodejs.org/) (v20+ LTS) — for local development
- Git

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/dsf-allowlist.git
cd dsf-allowlist

# 2. Copy environment template
cp .env.example .env

# 3. Generate RS256 key pair for JWT
bash scripts/generate-keys.sh

# 4. Start all services
docker compose up -d

# 5. Seed admin email
docker compose exec backend npx ts-node src/db/seed-whitelist.ts admin@example.com

# 6. (Optional) Seed test data
docker compose exec backend npx ts-node src/db/seed-testdata.ts
```

**Access:**
- Frontend: [http://localhost](http://localhost)
- Mailhog (dev email UI): [http://localhost:8025](http://localhost:8025)
- Backend API: [http://localhost/api/v1](http://localhost/api/v1)

## Authentication Flow

The portal uses **passwordless authentication** designed for a small, known admin team:

1. **Email** — Enter a whitelisted email address
2. **OTP** — 6-digit code sent via email (10 min TTL, single-use)
3. **TOTP** — Authenticator app verification (setup on first login)

Sessions use RS256 JWT (15 min) with httpOnly refresh token cookies (7 days).

## Admin Review

IMI administrators can review and approve/reject pending requests at `/app/admin`. Approval actions require TOTP re-confirmation for security.

Admins are configured via the `IMI_ADMIN_EMAILS` environment variable (comma-separated).

Notification flow:
- On submission: All admins receive email notification immediately
- On approve/reject: Admins notified immediately, site contacts notified after 30-minute delay

## Project Structure

```
dsf-allowlist/
├── frontend/          React SPA (Vite)
├── backend/           Express API (TypeScript)
├── db/migrations/     MySQL schema
├── nginx/             Reverse proxy configuration
├── mail/              Mailhog (dev email)
├── scripts/           Utility scripts
├── docs/              Documentation & design specs
└── docker-compose.yml Development environment
```

## Development

```bash
# Start services with hot reload
docker compose up -d

# Frontend dev server (standalone)
cd frontend && npm install && npm run dev

# Backend dev server (standalone)
cd backend && npm install && npm run dev

# Run type checks
cd frontend && npx tsc --noEmit
cd backend && npx tsc --noEmit
```

## Testing

```bash
# Backend integration tests (requires running Docker DB + Redis)
docker compose exec backend npm test

# Frontend unit tests
cd frontend && npm test

# Watch mode
docker compose exec backend npm run test:watch
cd frontend && npm run test:watch
```

## API

All entity endpoints are scoped to instances:

```
POST   /auth/request-otp
POST   /auth/verify-otp
POST   /auth/verify-totp

GET    /api/v1/instances
GET    /api/v1/instances/:id/organization
GET    /api/v1/instances/:id/contacts
GET    /api/v1/instances/:id/endpoints
GET    /api/v1/instances/:id/certificates
GET    /api/v1/instances/:id/memberships
POST   /api/v1/instances/:id/approval/submit
GET    /api/v1/instances/:id/download/bundle
GET    /api/v1/instances/:id/audit
```

Full API reference: see [CLAUDE.md](.claude/CLAUDE.md#api-routen-vollständig)

## Security

- Helmet.js security headers on all routes
- Rate limiting (Redis-backed): 5 req/15min on auth, 100 req/min on API
- CORS restricted to own domain
- Cookies: httpOnly, secure, sameSite=strict
- JWT: RS256 (asymmetric signing)
- SQL: Prepared statements only (Knex)
- PEM upload: Private keys rejected immediately
- Audit log: append-only, no UPDATE/DELETE
- DSGVO/GDPR: Contact data never published in allow list bundles

## Production Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full production deployment instructions.

```bash
# Production build
docker compose -f docker-compose.prod.yml up -d --build
```

## License

Proprietary — Institute of Medical Informatics Muenster (IMI), University of Muenster.
