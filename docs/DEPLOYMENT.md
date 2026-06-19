# Deployment Guide

## Prerequisites

- Docker Desktop (or Docker Engine + Compose Plugin)
- SSL certificates in `certs/` (server.crt, server.key)
- `.env.prod` filled (from `.env.prod.example`)

## Environment variables

All configuration flows through env vars (no hardcoded secrets). Copy `.env.example` to `.env` and fill in.

**Application:**
- `NODE_ENV` — `production` in prod
- `PORT` — backend HTTP port (default 3000)
- `FRONTEND_URL` — public URL for CORS and email links

**Database:**
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

**Redis:**
- `REDIS_URL`

**JWT (RS256, asymmetric):**
- `JWT_PRIVATE_KEY_BASE64` — base64-encoded RSA private key
- `JWT_PUBLIC_KEY_BASE64` — base64-encoded RSA public key
- `JWT_EXPIRES_IN` — e.g. `15m`
- `REFRESH_TOKEN_EXPIRES_IN` — e.g. `7d`

**TOTP encryption:**
- `TOTP_ENCRYPTION_KEY` — 32-byte hex key for AES-256 encryption of TOTP secrets at rest

**Mail (SMTP):**
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`

**DSF environment indicator:**
- `DSF_ENVIRONMENT` — `TEST` or `PRODUCTION`
- `DSF_ENV_COLOR` — hex color for the environment badge

**Rate limiting (Redis-backed):**
- `RATE_LIMIT_OTP_MAX` (default 5), `RATE_LIMIT_OTP_WINDOW_MS` (default 900000)
- `RATE_LIMIT_API_MAX` (default 100), `RATE_LIMIT_API_WINDOW_MS` (default 60000)

**Admin team:**
- `IMI_ADMIN_EMAILS` — comma-separated list. Each admin's email **domain** is treated as their "site" for the 4-eyes approval rule.

**Approval workflow:**
- `APPROVAL_SILENT_CONSENT_DAYS` — number of days a single-approved request waits before auto-approving via silent consent (Schweigen als Zustimmung). Default `7`.

**Session inactivity:**
- `IDLE_TIMEOUT_MS` — sliding inactivity timeout (default 1800000)

## First Production Deploy

```bash
# 1. Clone
git clone <repo-url>
cd num-dsf-allowlist

# 2. Environment
cp .env.prod.example .env.prod
# Fill .env.prod with real secrets

# 3. Generate keys
bash scripts/generate-keys.sh

# 4. Seed admin email
docker compose -f docker-compose.prod.yml run --rm backend \
  npx ts-node src/db/seed-whitelist.ts admin@imi.uni-muenster.de

# 5. Start
docker compose -f docker-compose.prod.yml up -d --build

# 6. Check logs
docker compose -f docker-compose.prod.yml logs -f backend
```

## Update Process

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build --no-deps backend frontend
```

## Database migrations

Migrations live at `db/migrations/*.sql` (NOT under `backend/src/`). They run automatically when the MySQL container starts (mounted at `/docker-entrypoint-initdb.d/` per `docker-compose.prod.yml`).

To apply a NEW migration to a running production DB without restarting:

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < db/migrations/006_*.sql
```

Each migration is a single `.sql` file with a 3-digit prefix. Files are applied in alphabetical order. Always inspect a migration before applying — there are no automated reverse migrations.

## Client-certificate sign-in (mTLS)

The portal supports two passwordless authentication paths:
1. **Email + OTP + TOTP** (default).
2. **Browser client certificate**, matched by SHA-256 thumbprint against `organizations.client_cert_thumbprint`.

For (2) to work in production, the operator must:

- Mount `/etc/nginx/certs/server.crt` and `/etc/nginx/certs/server.key` (the public TLS cert/key for the HTTPS listener).
- Mount `/etc/nginx/certs/client-ca.crt` — the CA whose certs you trust to issue admin/site client certs. With `ssl_verify_client optional_no_ca`, even self-signed test certs pass through to the backend, which authenticates by thumbprint match.

The HTTP vhost (port 80) clears any incoming `X-Client-Cert` header to prevent forgery; production should redirect HTTP→HTTPS.

To register a thumbprint, the instance owner uploads their cert via the Organization edit modal (the `clientCertThumbprint` field). Admins cannot modify another user's thumbprint.

## Scheduled jobs

All UTC, configured in `backend/src/services/scheduler.service.ts`:

| When | Job | Purpose |
|---|---|---|
| 06:00 daily | `runApprovalReminders` | Re-emails admins for approval requests pending > 3 days |
| 07:00 daily | `runSilentConsentSweep` | Promotes single-approved requests older than `APPROVAL_SILENT_CONSENT_DAYS` to APPROVED |
| 08:00 daily | `runCertExpiryCheck` | Emails site contacts when their cert is < 30 days from expiry |
| 09:00 daily | `runMembershipCleanup` | Hard-deletes soft-deleted memberships older than 90 days |

The scheduler starts at backend boot (`backend/src/index.ts`). Jobs swallow individual failures so one bad iteration doesn't kill the runner.

## Allow-list bundle download

The portal is the central authority that generates the **network-wide** DSF allow-list. There is one bundle — every site downloads the same thing and installs it at its local DSF FHIR server.

- **GUI:** authenticated users hit `GET /api/v1/download/full-bundle` (cookie auth) and receive a FHIR JSON Bundle.
- **DSF process (mTLS):** the upstream `dsf-process-allow-list/DownloadAllowList` BPMN task reads `GET /fhir/Bundle?identifier=http://dsf.dev/fhir/CodeSystem/allow-list|allow_list` from this portal's FHIR endpoint; client cert is matched by SHA-256 thumbprint against `organizations.client_cert_thumbprint`.

The previous per-instance route (`/api/v1/instances/:id/download/bundle?endpointId=...`) is retained for backward compatibility with older clients but should NOT be used for new integrations.

## Federation safety

This portal is designed to coexist with other Allow-List tools (e.g. a NUM-operated tool, future regional operators) in a federated DSF P2P network:

- Bundles emit `DELETE` only on `OrganizationAffiliation`. `Organization` and `Endpoint` records are never deleted from a participant's local FHIR server through our bundle — they may be referenced by another tool's allow-list.
- The site-side `InsertAllowList` BPMN process applies multiple bundles sequentially; conflicts on `Organization` PUTs are idempotent (each tool emits the same single cert thumbprint, since per-site the client cert == server cert).
- Memberships removed via the UI are soft-deleted; the next bundle emission carries the corresponding DELETE-Affiliation entry; a daily cron at 09:00 UTC hard-deletes soft-rows older than 90 days.

To opt out of soft-delete retention (e.g. for non-federated single-tool deployments), set `MEMBERSHIP_SOFT_DELETE_RETENTION_DAYS=0` (cleanup runs every day and removes immediately).

## Admin grants & user management

Admin role lives in the `admin_grants` table; each row is signed RS256 over a canonical message (`email|granted_at|granted_by_a|granted_by_b`). The app verifies the signature on every admin check — a DB-only attacker can't forge admin role without the signing key.

### Signing keys

- **Default:** `ADMIN_GRANT_PRIVATE_KEY_BASE64` and `ADMIN_GRANT_PUBLIC_KEY_BASE64` (recommended — separate from JWT keys for rotation independence).
- **Fallback:** `JWT_PRIVATE_KEY_BASE64` / `JWT_PUBLIC_KEY_BASE64` if the dedicated keys aren't set.

Generate dedicated keys:

```bash
openssl genrsa 2048 > admin_grant_private.pem
openssl rsa -in admin_grant_private.pem -pubout > admin_grant_public.pem
echo "ADMIN_GRANT_PRIVATE_KEY_BASE64=$(base64 -w0 admin_grant_private.pem)"
echo "ADMIN_GRANT_PUBLIC_KEY_BASE64=$(base64 -w0 admin_grant_public.pem)"
```

### First-run bootstrap

If `admin_grants` is empty on backend startup, the bootstrap reads `IMI_ADMIN_EMAILS` and creates a signed grant per address (with `granted_by_a = granted_by_b = SYSTEM:bootstrap`). Subsequent runs ignore the env var.

Operators are encouraged to remove `IMI_ADMIN_EMAILS` from prod env after the first successful boot — the DB is now authoritative.

### Adding new admins (post-bootstrap)

Promotion requires the 4-eyes principle: an existing admin creates a promotion request via `/app/admin/users` (Promote button); a second admin from a **different site** (different email domain) approves via `/app/admin/promotions`. Both confirmations are explicit; there is no silent-consent timer.

### Locking and removing users

The whitelist UI (`/app/admin/users`) supports lock (reversible) and remove (permanent) for any whitelisted email. Lock/demote/remove revoke the affected user's refresh tokens — they cannot continue active sessions. Self-lock and self-remove are blocked. Demote/remove that would leave fewer than 2 admins from 2 distinct sites is rejected.

### Key rotation procedure

If the signing key is compromised:

1. Generate new keypair.
2. Re-sign all `admin_grants` rows with the new private key. (One-shot script: `npx ts-node backend/src/scripts/resign-admin-grants.ts` — write this script when needed.)
3. Update env vars and restart backend.
4. Audit-log entries are not affected; signatures are only verified going forward.

## Rollback

Before each production deploy, snapshot the running image SHAs:

```bash
docker compose -f docker-compose.prod.yml images backend > deploy-snapshot-$(date +%F).txt
docker compose -f docker-compose.prod.yml images frontend >> deploy-snapshot-$(date +%F).txt
```

To roll back code, redeploy a previous git tag:

```bash
git checkout <previous-tag>
docker compose -f docker-compose.prod.yml up -d --build
```

Database rollbacks: there are no automated reverse migrations. If a recent migration must be reverted, write a counter-migration (e.g. `007_revert_approval_signatures.sql`) and apply it as in the Migrations section.

## Backups

### Automated Backup Script

```bash
# Run manually
bash scripts/backup-db.sh

# Run with custom backup directory
bash scripts/backup-db.sh /mnt/backups

# Schedule via cron (daily at 2 AM)
0 2 * * * cd /path/to/num-dsf-allowlist && bash scripts/backup-db.sh >> /var/log/dsf-backup.log 2>&1
```

The script:
- Creates a gzip-compressed MySQL dump with `--single-transaction` (no locks)
- Retains the last 30 backups, older ones are automatically deleted
- Verifies backup integrity (non-empty file check)
- Uses `docker compose exec` to access the DB container

### Manual Restore

```bash
gunzip < backups/dsf_allowlist_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose exec -T db mysql -u root -p${DB_ROOT_PASSWORD} dsf_allowlist
```

## Health Check

```bash
curl https://allowlist.imi.uni-muenster.de/health
```

## Production security checklist

Before going live, confirm:

- [ ] `IMI_ADMIN_EMAILS` populated with real ops admin addresses.
- [ ] `APPROVAL_SILENT_CONSENT_DAYS` set to your policy (default `7`).
- [ ] `JWT_PRIVATE_KEY_BASE64` / `JWT_PUBLIC_KEY_BASE64` rotated from any dev values.
- [ ] `TOTP_ENCRYPTION_KEY` set to a fresh 32-byte hex value (and securely stored).
- [ ] `nginx/nginx.prod.conf` mounts `server.crt`, `server.key`, `client-ca.crt`.
- [ ] HTTP vhost redirects to HTTPS (no plain-text proxy in prod).
- [ ] `.env` is not in git (gitignored).
- [ ] Email transport (`SMTP_*`) tested with a real notification.
- [ ] Database backups configured (see Backups section).
- [ ] Monitoring covers backend `/health`, MySQL liveness, Redis liveness.

## Secret rotation

If any of these are believed to have leaked, rotate immediately:

### JWT signing keys
1. Generate new keypair: `bash scripts/generate-keys.sh`
2. Update `.env.prod` (or k8s secret) with new `JWT_PRIVATE_KEY_BASE64` / `JWT_PUBLIC_KEY_BASE64`.
3. Restart backend: `docker compose -f docker-compose.prod.yml restart backend`
4. All existing sessions invalidate immediately (signatures fail).
5. Users must log in again.

### TOTP encryption key
This key encrypts TOTP secrets at rest in the `users` table. Rotating it requires re-encrypting every row.
1. Decrypt all `users.totp_secret` rows with the OLD key.
2. Re-encrypt with the NEW key.
3. Update `.env.prod` with new `TOTP_ENCRYPTION_KEY` (32-byte hex).
4. Restart backend.

A migration script for this is not currently provided — write one if rotation becomes necessary.

### Admin-grant signing keys
If the `ADMIN_GRANT_PRIVATE_KEY_BASE64` is suspected leaked: every existing `admin_grants` row becomes worthless (an attacker could forge new ones). Procedure:
1. Generate new keypair (same approach as JWT keys).
2. Update both `ADMIN_GRANT_PRIVATE_KEY_BASE64` and `ADMIN_GRANT_PUBLIC_KEY_BASE64` in `.env.prod`.
3. Truncate `admin_grants` table — every row is now invalid because signatures verify with the new public key.
4. Restart backend; the bootstrap routine will re-sign grants for `IMI_ADMIN_EMAILS`. Set this env var to the trusted bootstrap list before restart.
5. Use `/app/admin/users` to re-promote anyone who was an admin before the rotation, via the 4-eyes flow.

### TLS server cert + client CA (./certs)
1. Generate new server cert/key + new client CA via your CA process.
2. Replace files in `./certs/` (host) with `chmod 600`, owned by the user the nginx container runs as.
3. Restart nginx: `docker compose -f docker-compose.prod.yml restart nginx`.
4. Verify with `openssl s_client -connect <host>:443 -showcerts`.
