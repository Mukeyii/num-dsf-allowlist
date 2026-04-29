<div align="center">
  <img src="frontend/public/logos/dsf-logo.svg" alt="DSF" height="60" />
  <h1>DSF Management Portal</h1>
  <p>A web application for managing participants in the <strong>Data Sharing Framework (DSF)</strong> of the German Medical Informatics Initiative (MII/NUM).</p>
  <p>Operated by the <a href="https://www.medizin.uni-muenster.de/imi/das-institut.html">Institute of Medical Informatics Muenster (IMI)</a> at the University of Muenster.</p>

  <br />

  <a href="https://www.medizin.uni-muenster.de/imi/das-institut.html"><img src="frontend/public/logos/IMI-Logo-grad-eng.png" alt="IMI" height="40" /></a>
  &nbsp;&nbsp;
  <a href="https://medic.uni-muenster.de/"><img src="frontend/public/logos/Logo_MeDIC_RGB_1000pxl_WEB_transp.png" alt="MeDIC" height="36" /></a>
  &nbsp;&nbsp;
  <img src="frontend/public/logos/NUM-LOGO-POS-DE-RGB_neu.png" alt="NUM" height="28" />
  &nbsp;&nbsp;
  <img src="frontend/public/logos/dsf-logo.svg" alt="DSF" height="28" />
</div>

---

## Overview

The portal manages a central directory of five interconnected entities:

- **Organizations** — Healthcare institutions participating in the DSF network
- **Contacts** — Responsible persons per organization (MEDIC, DSF_ADMIN, SECURITY)
- **Endpoints** — DSF FHIR endpoints with associated IP addresses
- **Certificates** — X.509 certificates for secure communication
- **Memberships** — Organizational affiliations and roles (DIC, HRP, DMS, AMS)

All entities are displayed simultaneously on an interactive entity-graph canvas with SVG relation lines — no tab switching, no page navigation. Everything is visible and editable on a single screen.

A separate **Network Map** page (`/app/map`) renders the cross-instance allow-list as a schematic Germany silhouette with one pin per organization, multi-site cities collapsed into clusters with worst-status indicators, peer edges drawn from shared `parent_organization` (e.g. MII, NUM), and filters for verbund, certificate status, and city.

## Screenshots

![Entity-graph canvas](docs/screenshots/01-canvas.png)

**Entity-graph canvas** — every entity for one DSF instance edited on a single canvas, with live SVG relations between organization, contacts, endpoints, certificates, and memberships.

| | |
|---|---|
| ![Network map](docs/screenshots/02-map.png)<br>**Network map** — cross-instance allow-list directory across all participating organizations, with city clusters and verbund peer edges. | ![Approval review](docs/screenshots/03-admin-approval.png)<br>**Approval review** — IMI admins review and action pending submissions with the full snapshot in context. |
| ![Audit log](docs/screenshots/04-audit.png)<br>**Audit log** — append-only operations history, scoped per instance, filterable by resource and operation. | ![Sign in](docs/screenshots/05-login.png)<br>**Sign in** — passwordless email + OTP + TOTP, plus optional client-certificate sign-in. |

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
4. **Optional: client certificate** — if the browser holds a registered client cert, sign in with one click. The cert's SHA-256 thumbprint is matched against `organizations.client_cert_thumbprint`.

Sessions use RS256 JWT (15 min) with httpOnly refresh token cookies (7 days).

## Admin Console

IMI administrators access three admin pages:

- **`/app/admin`** — pending approval-request review (4-eyes, silent-consent after 7 days).
- **`/app/admin/users`** — whitelist + admin role management (lock / unlock / promote / demote / remove). All writes require TOTP re-confirmation.
- **`/app/admin/promotions`** — pending admin-promotion requests; second admin from a different site approves or rejects (NO silent consent).

Admin-role assignments are stored in `admin_grants`, each row signed RS256 over a canonical message. A DB-only attacker cannot grant themselves admin without the signing key.

The bootstrap admin set is populated on first backend start from `IMI_ADMIN_EMAILS` env var. After that, the env var is ignored at runtime — the database is authoritative. Operators are encouraged to remove the env var from production after first boot.

## Bundle Security

- Every FHIR Bundle download is **RS256-signed** (`X-Bundle-Signature` header)
- **SHA-256 content hash** logged in the audit trail (`X-Content-Hash` header)
- DSF processes authenticate via **mTLS client certificates** at `/fhir/Bundle/:endpointId`
- Client certificate thumbprints are stored per organization

## Network map

`/app/map` renders the network-wide allow-list as a schematic Germany silhouette. Pins per organization (clustered by city), peer edges per `parent_organization` verbund (MII / NUM), filters for verbund / cert-status / city / activity. Theme-aware: dark mode inverts the silhouette palette.

## Federation safety

The portal coexists with other Allow-List tools (e.g., a NUM-operated tool, future regional operators). Bundles emit `DELETE` only on `OrganizationAffiliation`; `Organization` and `Endpoint` records are never deleted from a participant's local FHIR server through our bundle (they may be referenced by another tool's allow-list).

Memberships removed via the UI are soft-deleted; the next bundle emission carries the corresponding DELETE-Affiliation entry; a daily cron at 09:00 UTC hard-deletes soft-rows older than 90 days (`MEMBERSHIP_SOFT_DELETE_RETENTION_DAYS` configurable).

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

### Pre-commit hooks

The repo ships gitleaks-based pre-commit hooks to block accidental commit of JWT private keys, SendGrid API keys, or TOTP encryption keys. After cloning, enable them with:

```sh
git config core.hooksPath .githooks
```

Install gitleaks (`brew install gitleaks` on macOS, `choco install gitleaks` on Windows) so the hook can run. Bypass with `git commit --no-verify` only if you understand the risk.

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
GET    /api/v1/network/map               (cross-instance map data)

GET    /fhir/Bundle/:endpointId    (mTLS auth — for DSF BPE process)
GET    /fhir/Bundle                (mTLS auth — search by identifier)
```

Full API reference: see [`docs/wiki/API-Reference.md`](docs/wiki/API-Reference.md).

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

**New env vars (Spring 2026):**
- `APPROVAL_SILENT_CONSENT_DAYS` (default 7)
- `MEMBERSHIP_SOFT_DELETE_RETENTION_DAYS` (default 90)
- `ADMIN_GRANT_PRIVATE_KEY_BASE64` (optional, falls back to JWT keys)
- `ADMIN_GRANT_PUBLIC_KEY_BASE64` (optional, falls back to JWT keys)
- `IMI_ADMIN_EMAILS` — comma-separated list, used only for first-run admin bootstrap; ignored at runtime once `admin_grants` is populated.

## Database migrations

Migration files live in `db/migrations/*.sql`. They are applied automatically by MySQL's docker entrypoint on FIRST init only. To apply new migrations to an existing dev DB:

````bash
DB_PASSWORD=$(grep ^DB_PASSWORD .env | cut -d= -f2)
docker compose exec -T db mysql -udsf -p${DB_PASSWORD} dsf_allowlist < db/migrations/008_*.sql
````

Each migration is idempotent (uses `information_schema` checks via `PREPARE`/`EXECUTE`), so re-running them is safe. CI loops `for f in db/migrations/*.sql` to apply all of them on every test DB.

## License

Proprietary — Institute of Medical Informatics Muenster (IMI), University of Muenster.
