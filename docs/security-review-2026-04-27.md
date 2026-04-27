# Security Review — 2026-04-27

**Scope:** DSF Allow List Management Portal, branch `main`.
**Reviewer:** subagent (claude-opus-4-7).
**Method:** Static code review of the 10 categories specified in the plan.

## Summary

| # | Category | Critical | Important | Minor | Informational |
|---|---|---|---|---|---|
| 1  | Authentication               | 0 | 1 | 1 | 1 |
| 2  | Authorization                | 0 | 2 | 0 | 1 |
| 3  | Input validation             | 0 | 1 | 1 | 1 |
| 4  | Bundle download / FHIR       | 0 | 0 | 1 | 1 |
| 5  | Audit log integrity          | 0 | 1 | 0 | 1 |
| 6  | CSP / security headers       | 0 | 2 | 1 | 0 |
| 7  | Cookie / session config      | 0 | 0 | 1 | 1 |
| 8  | Secret handling              | 0 | 0 | 1 | 1 |
| 9  | PEM upload                   | 0 | 0 | 1 | 1 |
| 10 | Rate limiting                | 0 | 1 | 1 | 1 |
| **Total** | | **0** | **8** | **8** | **9** |

## Critical Findings (Action Required)

**No critical findings.**

The closest call is finding 2.1 (mTLS header forging via the HTTP nginx vhost). It is exploitable only on the cleartext port 80 vhost with the current nginx config in this repo. In production we expect TLS-only deployment with port 80 redirecting to HTTPS, which would mitigate the issue — but the repo's `nginx/nginx.conf` does not enforce that and also does not strip the `X-Client-Cert` header on the HTTP listener. I have classified it Important rather than Critical because the cert-login route was added in this branch's recent commits and the deployment topology is the operator's call; it should still be fixed before any non-localhost deploy.

## Findings by Category

### 1. Authentication

**Files inspected:**
- `backend/src/routes/auth.routes.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/services/otp.service.ts`
- `backend/src/services/totp.service.ts`
- `backend/src/middleware/auth.middleware.ts`
- `frontend/src/stores/auth.store.ts`

**Strengths**
- OTP generated with `crypto.randomInt(0, 1000000)` and SHA-256-hashed before Redis storage (`backend/src/services/otp.service.ts:18`, `:22`). Plaintext is never persisted.
- OTP single-use: `verifyOtp` always deletes the Redis key after the comparison, regardless of whether the comparison succeeds (`backend/src/services/otp.service.ts:42`). `crypto.timingSafeEqual` is used for the comparison.
- TOTP secrets are encrypted at rest with AES-256-GCM (`backend/src/services/totp.service.ts:22-38`), window is the recommended 1 step (`:65`), and a 60-second replay window is enforced via Redis (`:71-75`).
- Backup codes are bcrypt-hashed at cost 12, single-use, removed from the array on consumption (`backend/src/services/totp.service.ts:85-121`).
- JWT signing uses RS256 with explicit algorithm pinning on both sign and verify (`backend/src/services/auth.service.ts:31, 39, 44, 48`). HS256 is not accepted.
- Refresh tokens are 48-byte random, SHA-256-hashed in Redis, rotated on every `/auth/refresh`, and revoked on logout (`backend/src/services/auth.service.ts:155-200`).
- Access token is only stored in JS memory on the frontend, never `localStorage`/`sessionStorage` (`frontend/src/stores/auth.store.ts:3-32`).

**Findings**

- **Important — `dev-login` and `client-cert-login` rate limiting gap**
  `backend/src/routes/auth.routes.ts:145-220` define `/auth/dev-login` and `/auth/client-cert-login` without any `otpLimiter`. While `/auth/dev-login` is gated by `NODE_ENV !== 'production' && DEV_AUTO_LOGIN === 'true'` and is therefore safe in prod, `/auth/client-cert-login` is reachable in production. A misconfigured or compromised cert path would let an attacker brute-force thumbprints unbounded at the application layer (nginx still applies the 5 r/m zone, so this is defence-in-depth, not exploitable on its own).

- **Minor — Refresh-token cookie is `secure: process.env.NODE_ENV !== 'test'`**
  `backend/src/routes/auth.routes.ts:36`. In a hypothetical `NODE_ENV=development` deployment behind a reverse proxy that terminates TLS, this is fine; but the inverse condition (default true unless `test`) means the flag is set even when `NODE_ENV=undefined`. Recommendation: explicit `secure: process.env.NODE_ENV === 'production'` and rely on `127.0.0.1` over plain HTTP for dev. Low risk because the dev compose file binds nginx to `localhost`.

- **Informational — Idle-timeout key written from a non-blocking `.catch`**
  `backend/src/middleware/auth.middleware.ts:31`. If Redis is briefly unavailable, the `activity:` key is not refreshed, and the next refresh-token call will reject the user with `SESSION_EXPIRED`. Acceptable, but worth a note for ops (depends on Redis health).

### 2. Authorization

**Files inspected:**
- `backend/src/middleware/instance.middleware.ts`
- `backend/src/middleware/admin.middleware.ts`
- `backend/src/lib/isAdmin.ts`
- All `backend/src/routes/*.routes.ts` (verified every entity router calls `requireAuth, requireInstanceOwnership` at module level).

**Coverage matrix.** Every entity router (`organization`, `contacts`, `endpoints`, `certificates`, `memberships`, `approval`, `audit`, `download/bundle`) mounts `requireAuth` then `requireInstanceOwnership` at the router level. Admin-only routers (`admin`, `admin-approval`, `download/ip-address-list`) mount `requireAuth, requireImiAdmin`. `network` requires only `requireAuth` because the response is filtered server-side based on `isAdmin`. `instances.routes.ts` enforces ownership inline (`user_id: req.user!.id`). The audit-log filter on `/api/v1/instances/:id/audit` correctly scopes by `instance_id` (`backend/src/routes/audit.routes.ts:16`).

**Findings**

- **Important — Admin override on `requireInstanceOwnership` skips all per-instance authZ**
  `backend/src/middleware/instance.middleware.ts:33-37`. When the calling user matches `IMI_ADMIN_EMAILS`, the `where user_id = req.user!.id` filter is dropped. This means an admin's JWT can mutate any user's contacts, endpoints, certificates, memberships, and submit/withdraw approvals on behalf of any user. The audit log records the admin's email (good) but the action is functionally the user's. CLAUDE.md explicitly grants admins read-access to assist; the recent commits expanded this to write-access. Recommendation: split read vs. write. An admin reviewing another user's instance should have GET access, but mutations on someone else's instance should require either a capability flag or explicit "impersonate" mode. (Currently a frontend banner is the only safeguard — that's UI, not authZ.)

- **Important — TOTP step-up on admin approve/reject relies on the admin user's TOTP setup, not on a fresh challenge**
  `backend/src/routes/admin-approval.routes.ts:25-44`. The TOTP code is taken from `req.body.totpCode` and validated against the stored secret. Anti-replay covers only 60 s (`backend/src/services/totp.service.ts:71-76`), which is fine, but: if an attacker has a valid admin access token AND has briefly observed a TOTP code from the admin's authenticator (e.g., via shoulder-surfing or screen sharing), they have a full 30-60 second window to replay against `/api/v1/admin/approval/:rid/approve`. There is no "approval-specific" TOTP challenge derivation. This is consistent with how speakeasy is normally used and may be acceptable, but it's a defence-in-depth gap when the action being approved is irreversible (whitelist additions / org approvals). Recommendation: bind the challenge to the request (e.g., HOTP counter per admin, or require backup-code-style nonce).

- **Informational — `isAdminEmail` reads `IMI_ADMIN_EMAILS` at every call**
  `backend/src/lib/isAdmin.ts:7-11`. This is intentional (per the file comment, to allow tests to mutate env) but means a misconfigured deploy can silently grant admin to anyone listed. Tests cover this elsewhere.

### 3. Input validation

**Files inspected:**
- `backend/src/middleware/validate.middleware.ts`
- `backend/src/schemas/*.schema.ts`
- `frontend/src/schemas/*.schema.ts`
- All route handlers, plus `backend/src/db/connection.ts` and a repo-wide grep for `db.raw`, `whereRaw`, `orderByRaw`, `havingRaw`.

**SQL parameterisation.** No `whereRaw`/`orderByRaw`/`havingRaw` in `backend/src/`. Only four `db.raw` calls exist (`backend/src/db/connection.ts:21`, `backend/src/__tests__/setup.ts:8`, two in a test file) and all use static strings, no user input. Knex parameterisation is therefore intact across the codebase.

**Findings**

- **Important — `instances.routes.ts` PUT `/:id/label` takes raw `req.body.label` with no Zod schema**
  `backend/src/routes/instances.routes.ts:45-52`. There is no length cap, no character-class restriction. Knex prepares the statement, so SQL injection is not the risk; but a 10 MB label bypasses the `express.json({ limit: '100kb' })` only if json parsing somehow lets it through (it doesn't), so the practical risk is "user can store arbitrary unicode in their own instance label." Still a policy gap because every other input has a Zod schema.

- **Minor — Audit query schema's `resource` enum omits `APPROVAL`**
  `backend/src/schemas/query.schema.ts:9`. Audit log writes use `resource_type: 'APPROVAL'` (`backend/src/services/approval.service.ts:34, 57, 66`) but the filter UI cannot select that value because the Zod enum rejects it. Filter requests come back with `400 VALIDATION`. Functional bug masquerading as a security finding; classified Minor.

- **Informational — Frontend Zod schemas are permissive vs. backend**
  E.g., `frontend/src/schemas/membership.schema.ts:6` requires only `parentOrganization` length ≥ 3 with no max; backend `createMembershipSchema` caps at 255. The backend is the security boundary (good); the frontend serves UX validation, so the looser cap is acceptable. Note for future tightening.

### 4. Bundle download / FHIR

**Files inspected:**
- `backend/src/routes/fhir.routes.ts`
- `backend/src/routes/download.routes.ts`
- `backend/src/services/fhir.service.ts`
- `backend/src/services/bundle-signing.service.ts`
- `backend/src/services/excel.service.ts`

**DSGVO redaction (CLAUDE.md "Contact data never published in allow list bundles").**
`generateBundle` (`backend/src/services/fhir.service.ts:19-135`) and `generateFullBundle` (`:141-238`) only emit `Organization`, `Endpoint`, and `OrganizationAffiliation` resources. Contacts table is never queried, the `email`, `phone`, `address_line` fields of the org are **not** included in either bundle (`:53-57` only emits `name` and `identifier`; the per-cert thumbprint extension is included but that's a thumbprint, not contact data). DSGVO requirement holds.

**Findings**

- **Minor — Bundle signature is RS256-JWT containing only `contentHash + timestamp`, with `expiresIn: '365d'`**
  `backend/src/services/bundle-signing.service.ts:13-23`. A consumer that re-validates the bundle a year later may still find the signature valid even if the issuing key was rotated. There is no `kid` header to support rotation. Recommendation: add `kid`, shorten `expiresIn` to e.g. 30 days, and document a key-rotation procedure.

- **Informational — `/fhir/Bundle` searchset returns only the *first* endpoint**
  `backend/src/routes/fhir.routes.ts:96`. Functional issue, not a security one — but if an attacker registers a wildcard org with a known cert and many endpoints, they only ever see the first. Worth surfacing.

### 5. Audit log integrity

**Files inspected:**
- `backend/src/services/audit.service.ts`
- Repo-wide `db('audit_logs')` grep.
- `db/migrations/001_initial_schema.sql`

**Append-only verification.** `db('audit_logs').update(` returns **zero** matches across the entire backend. `db('audit_logs').del(` returns two matches, both in non-production code paths: `backend/src/db/seed-testdata.ts:114` (test seeder, scoped to three known emails) and `backend/src/__tests__/helpers/seed.ts:14` (test helper). Production code paths (`backend/src/routes/admin.routes.ts:50-51`, `backend/src/routes/audit.routes.ts:15-25`) only `select`/`count`. **Append-only requirement is upheld in production code.**

**Findings**

- **Important — Append-only is enforced only at the application layer; the DB has no constraint**
  `db/migrations/001_initial_schema.sql:158-173`. `audit_logs` is a plain InnoDB table with `id` PK and indexes. Any code path with DB credentials (or any DBA) can `UPDATE`/`DELETE` rows. CLAUDE.md states "append-only, kein UPDATE/DELETE auf audit_logs Tabelle". Recommendation: enforce at DB level, e.g.
  ```sql
  CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs
    FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only';
  CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs
    FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_logs is append-only';
  ```
  Plus consider a separate, lower-privileged DB user for the audit insert path.

- **Informational — Audit-log write failures fall back to `console.error` only**
  `backend/src/services/audit.service.ts:39`. By design (must not block the operation). Worth feeding stderr into a centralised log so silent audit-write failures are observable.

### 6. CSP / security headers

**Files inspected:**
- `backend/src/app.ts` (helmet config, lines 34-51)
- `nginx/nginx.conf`

**Helmet (Express).** `app.use(helmet({...}))` at `backend/src/app.ts:34-51` sets:
- CSP: `default-src 'self'`, `script-src 'self'` (no inline/eval — good), `style-src 'self' 'unsafe-inline'`, `font-src 'self' https://fonts.gstatic.com`, `connect-src 'self'`, `frameAncestors 'none'`.
- HSTS: 2 years, `includeSubDomains`, `preload` — good.
- `frameguard: deny`, `noSniff: true`, `xssFilter: true`, `referrerPolicy: strict-origin-when-cross-origin`, COOP `same-origin`.

**nginx.** Adds X-Frame-Options=DENY, X-Content-Type-Options=nosniff, Referrer-Policy, Permissions-Policy, AND a separate CSP that overrides the Helmet one for routes that go through nginx (because nginx adds it before the proxy_pass response is sent — actually `add_header` only adds when the response status is 2xx/3xx/204/206/301/302/303/304/307/308 by default, and `always` was specified, so it does add to all responses). The nginx CSP is **looser** than the Helmet CSP because it allows `'unsafe-inline' 'unsafe-eval'` in `script-src` for Vite HMR.

**Findings**

- **Important — nginx CSP allows `'unsafe-inline' 'unsafe-eval'` in `script-src` and is the effective CSP for browser responses**
  `nginx/nginx.conf:14`. The file's TODO comment acknowledges this is dev-only and needs tightening for production. Because the same nginx config is used in `docker-compose.prod.yml` (verified next), shipping prod with this CSP eliminates the XSS mitigation. The Helmet CSP set by Express is overwritten by nginx's `add_header` (or both are sent and the browser concatenates them; either way `'unsafe-inline'` becomes effective). Must be split into prod vs. dev nginx configs before production deploy.

- **Important — HTTPS server block does not strip the `X-Client-Cert` header set by clients**
  `nginx/nginx.conf:69-125`. The HTTPS vhost overwrites `X-Client-Cert` with `$ssl_client_escaped_cert`, which is correct. **However**, the HTTP vhost (port 80, lines 26-67) does NOT set or clear `X-Client-Cert`, so a request like `curl -H 'X-Client-Cert: <attacker-pem>' http://host/auth/client-cert-login` will pass the header straight through nginx to `extractClientCert` (`backend/src/lib/clientCert.ts:20`). The backend will compute a thumbprint from the attacker-supplied PEM and authenticate any organisation that has that thumbprint registered. The repo currently exposes both port 80 and 443 in nginx, making this exploitable from any network that can reach port 80. Mitigations: (a) make port 80 a pure HTTP→HTTPS redirect, (b) `proxy_set_header X-Client-Cert ""` and `proxy_set_header X-SSL-Client-Cert ""` on every `location` block in both vhosts, including the HTTPS one (currently set per-location, not at the http/server level — easy to forget on a new location).

- **Minor — `X-XSS-Protection: 1; mode=block` is the only header value some legacy browsers will honour, but it can introduce vulnerabilities in older Chromes**
  `nginx/nginx.conf:9`. Modern advice (OWASP) is to set `X-XSS-Protection: 0` and rely on CSP. Low risk; cosmetic.

### 7. Cookie / session config

**Files inspected:**
- `backend/src/routes/auth.routes.ts:34-40` (`REFRESH_COOKIE_OPTIONS`)
- All `res.cookie` usages.

**Configuration.** `httpOnly: true`, `sameSite: 'strict'`, `secure: process.env.NODE_ENV !== 'test'`, `maxAge: 7 * 24 * 60 * 60 * 1000`, `path: '/auth/refresh'`. Used consistently for `refreshToken` issuance (`auth.routes.ts:101, 118, 133, 180, 209`). Logout clears with `res.clearCookie('refreshToken', { path: '/auth/refresh' })`.

**Findings**

- **Minor — `secure` flag is true unless `NODE_ENV === 'test'`**
  Already covered in finding 1.2. The cleaner conditional is `secure: process.env.NODE_ENV === 'production'`, paired with HTTPS-only dev.

- **Informational — Cookie path scoped to `/auth/refresh`**
  Means the cookie is not sent on `/auth/logout` calls and the logout handler reads from `req.cookies?.refreshToken` (`backend/src/routes/auth.routes.ts:224`). Because the cookie path is `/auth/refresh`, a `POST /auth/logout` from the SPA will NOT include the cookie, so `logout` short-circuits without revoking the refresh token in Redis. The cookie is only cleared client-side. Recommendation: scope the cookie to `/auth` or have logout call refresh first to discover the cookie. Filed as Informational only because the access token already expires in 15 min and rotation on next refresh would in any case require the cookie.

### 8. Secret handling

**Files inspected:**
- `.gitignore`, `.env.example`, `.env.prod.example`
- Repo-wide grep for `BEGIN.*PRIVATE KEY`, `password\s*=\s*["']`, `(SECRET|TOKEN|API_KEY)\s*=\s*["'][^"'$]{8,}` in `backend/src` and `frontend/src`.

**Results.**
- `.env`, `.env.prod`, `.env.local`, `.env.*.local` are in `.gitignore` (`.gitignore:1-5`).
- `git ls-files | grep .env` returns only `.env.example` and `.env.prod.example` — no real secrets tracked.
- `.env.example` and `.env.prod.example` contain placeholders only (`CHANGE_ME_GENERATE_RANDOM`, `GENERATE_ME`, `STARKES_PASSWORT_HIER`).
- No `BEGIN ... PRIVATE KEY` strings in source. No hardcoded passwords/secrets/tokens in `backend/src` or `frontend/src`.
- `pino` is configured to redact `password`, `token`, `pem`, `secret`, `otp`, `code`, `totpCode`, `backupCodes`, `req.headers.authorization`, `req.headers.cookie` (`backend/src/lib/logger.ts:18-30`).

**Findings**

- **Minor — `.env.prod.example` line 25 has a `SG.XXXXXXXXXXXXX` placeholder that looks shaped like a real Sendgrid API key**
  `.env.prod.example:25`. Devs may grep for `SG.` and assume it is a real leak; it is a placeholder. Recommendation: rename to `SENDGRID_API_KEY_HERE` for clarity. No actual secret leaked.

- **Informational — `pino` redaction list is path-based, not value-based**
  `backend/src/lib/logger.ts:18-30`. Calling `logger.info({ payload: { pem: '...' } })` would NOT redact because the path is `payload.pem`, not `pem`. The current code never logs PEM, but the redaction is shallower than it appears.

### 9. PEM upload (private-key rejection)

**Files inspected:**
- `backend/src/services/certificate.service.ts`
- `backend/src/routes/certificates.routes.ts`
- `backend/src/schemas/certificate.schema.ts`
- `frontend/src/schemas/certificate.schema.ts`
- Grep for `console.log`, `logger.info` against PEM in cert paths.

**Boundary checks.** `rejectPrivateKey` (`backend/src/services/certificate.service.ts:11-15`) rejects any PEM containing `PRIVATE KEY`, `ENCRYPTED PRIVATE KEY`, `RSA PRIVATE KEY`, or `EC PRIVATE KEY`. Called from `parseCertificate:18` and `createCertificate:39`. The route handler maps `PRIVATE_KEY_REJECTED` to HTTP 400 (`backend/src/routes/certificates.routes.ts:34-36`). The global error handler also has a fallback (`backend/src/app.ts:147-149`). The frontend Zod schema rejects `PRIVATE KEY` at form submit (`frontend/src/schemas/certificate.schema.ts:7`). No `console.log`/`logger.info`/`logger.debug` calls reference PEM content in the certificate path (verified via two greps).

**Findings**

- **Minor — Rejection is substring-based and case-sensitive**
  `backend/src/services/certificate.service.ts:12`. A maliciously crafted PEM-like blob with `private key` (lowercase) would pass the substring guard. `node-forge` would then likely reject it on parse, but the explicit guard would not have triggered. Recommendation: case-insensitive match (`/private key/i`) and also scan after `pem.toUpperCase()`.

- **Informational — `pem` is stored in the `certificates` table verbatim**
  `backend/src/services/certificate.service.ts:44`. PEMs are public material so this is fine, but the column carries the full PEM rather than just the parsed fields. Anyone with read access to the DB can re-derive the same data; not a leak, just a note.

### 10. Rate limiting

**Files inspected:**
- `backend/src/middleware/rateLimit.middleware.ts`
- `backend/src/app.ts:74-76`
- All auth and admin route files for per-route usage.
- `nginx/nginx.conf:17-18, 31-43, 84-103`.

**Configuration.** `otpRateLimit` is 5 req / 15 min keyed by IP (`backend/src/middleware/rateLimit.middleware.ts:19-26`). `apiRateLimit` is 100 req / 60 s keyed by `req.user?.id || req.ip` (`:28-36`). Both backed by Redis. `app.ts:75` mounts `apiRateLimit` on `/api`. `auth.routes.ts:43` applies `otpLimiter` to `request-otp`, `verify-otp`, `verify-totp`, `confirm-totp`, `refresh`, `logout`. `admin-approval.routes.ts:23, 47` applies `otpLimiter` to approve/reject (good). nginx adds a parallel layer: 5 r/m on `/auth/`, 100 r/m on `/api/`. **Configuration matches CLAUDE.md (5/15min auth, 100/min API).**

**Findings**

- **Important — `otpLimiter` is bypassed in `NODE_ENV === 'test'` AND `apiRateLimit` is bypassed in `NODE_ENV !== 'production'`**
  `backend/src/routes/auth.routes.ts:43` (`const otpLimiter = process.env.NODE_ENV === 'test' ? [] : [otpRateLimit];`) and `backend/src/app.ts:74` (`if (process.env.NODE_ENV !== 'test')`). The auth rate limit only skips `test`, which is correct. However, note that **a misconfigured deploy with `NODE_ENV=test` (or unset) loses both rate limits**, falling back to nginx-only. nginx's `limit_req zone=auth burst=3 nodelay` is still in place but applies per IP, so an attacker behind a NAT or sharing a proxy is the only realistic risk. Recommendation: explicit allow-list (`NODE_ENV in ['test']`) with a startup-time assertion that `NODE_ENV` is one of `production|development|test`.

- **Minor — `/auth/dev-login` and `/auth/client-cert-login` are not under `otpLimiter`**
  Already noted in finding 1.1. The nginx zone covers them, but defence-in-depth is missing.

- **Informational — `apiRateLimit` keyGenerator falls back to `req.ip` for unauthenticated requests**
  `backend/src/middleware/rateLimit.middleware.ts:32`. Because `/api` requires auth, this fallback is rarely exercised, but if someone introduces an unauthenticated `/api` route in the future, multiple unauthenticated users behind the same NAT would share a quota.

## Out of Scope

- Third-party dependency CVEs (no `npm audit` was run — out of scope for static review).
- Front-end XSS in third-party components (e.g., shadcn/ui internals).
- Docker image hardening (USER directive, distroless base, etc.) — only nginx and Express config were inspected.
- TLS configuration of the listening server beyond nginx (cert provisioning, ciphers, OCSP).
- Email-content review beyond OTP message HTML escaping (verified `esc()` helper in `mail.service.ts:10`).
- Session-cookie behaviour across browsers (only the server-side flags were verified).
- Database backup & retention strategy (relevant to audit-log integrity but not in code).
- Frontend bundle integrity (e.g., subresource integrity for fonts loaded from `fonts.gstatic.com`).
