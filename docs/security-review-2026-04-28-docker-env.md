# Security Review — Docker + .env (2026-04-28)

**Scope:** docker-compose.yml, docker-compose.prod.yml, .env.example, .env.prod.example, all Dockerfiles, .gitignore.
**Reviewer:** automated audit.

## Summary

| Severity | Count |
|---|---|
| HIGH | 4 |
| MEDIUM | 7 |

## HIGH

### H1: Real RSA JWT private key + TOTP encryption key in working-tree .env
- File: `.env:18,24`
- Risk: anyone with file-system access on a developer machine can mint JWTs. The file is gitignored (not committed), but persists in backups, screenshots, and shared-screen sessions.
- Resolution: PARTIAL — pre-commit hook (`gitleaks`) added in commit fixing H1 to prevent future commits; rotation is an operator action documented in `docs/DEPLOYMENT.md`.

### H2: .env.prod.example placeholders look real and are sync-prone
- File: `.env.prod.example:9-13,25`
- Risk: SendGrid-format placeholder `SG.XXXX…` invites real-key replacement; `REDIS_URL` and `REDIS_PASSWORD` are coupled but stored separately.
- Resolution: FIXED — placeholders rewritten to obvious markers (`<GENERATE_WITH_OPENSSL_RAND>`); coupling documented.

### H3: db/migrations mounted via docker-entrypoint-initdb — silent migration drift
- File: `docker-compose.yml:55`
- Risk: SQL files added after the volume is created never run.
- Resolution: DEFERRED — a real migration runner (Knex programmatic migrate) is a separate sub-project. Manual workaround: `docker compose exec -T db mysql -u… < db/migrations/<file>.sql` documented in DEPLOYMENT.md.

### H4: ./certs mount has weak hygiene
- File: `docker-compose.prod.yml:13`
- Risk: TLS keys live in plain files on the host with no documented rotation or permission baseline.
- Resolution: DEFERRED — Docker secrets / Vault integration is a future improvement. Interim mitigation: documentation of permission baseline (`chmod 600`, owned by dedicated user) added to DEPLOYMENT.md.

## MEDIUM

### M1: No .dockerignore in backend/ or frontend/
- File: missing
- Resolution: FIXED in Task 2.

### M2: Frontend & nginx prod nginx master runs as root
- File: `frontend/Dockerfile:20-26`, `nginx/Dockerfile.prod:1-3`
- Resolution: FIXED in Task 8.

### M3: No security_opt / cap_drop / read_only / tmpfs on prod services
- File: `docker-compose.prod.yml`
- Resolution: FIXED in Task 7.

### M4: Unpinned base images
- File: `nginx/Dockerfile:1`, `mail/Dockerfile:2`, `docker-compose.yml:75`
- Resolution: FIXED in Task 3.

### M5: No log rotation in prod compose
- File: `docker-compose.prod.yml`
- Resolution: FIXED in Task 6.

### M6: Dev DEV_AUTO_LOGIN=true + RATE_LIMIT_OTP_MAX=50 on a non-localhost-bound process is unsafe
- File: `.env:38,46`
- Resolution: FIXED in Task 9 — startup-time assertion guards against non-localhost binding when the dev shortcuts are on.

### M7: MySQL root password fallback `root_dev_password`
- File: `docker-compose.yml:49,57`
- Resolution: FIXED in Task 4.

## What's NOT in this review

- nginx mTLS / X-Client-Cert handling (already audited in `docs/security-review-2026-04-27.md`).
- Application-level RBAC (audited via the cryptographic admin-grants work).
- Frontend XSS (separate review).
