# Security

## Authentication

- **Passwordless** — No passwords stored. Authentication via email OTP + TOTP 2FA.
- **OTP** — 6-digit code, SHA-256 hashed in Redis, 10-minute TTL, single-use
- **TOTP** — Authenticator app, ±1 step tolerance (30s window), anti-replay (a used code is claimed in Redis for 120s and cannot be reused)
- **Backup Codes** — 10 codes, bcrypt-hashed, single-use
- **Sessions** — JWT (RS256, 15 min) + httpOnly refresh token cookie (7 days); refresh tokens rotate on use and are revocable

## Authorization

- **Rate Limiting** — 5 req/15min on auth endpoints, 100 req/min on API (Redis-backed)
- **Instance Ownership** — Users can only access their own instances
- **Admin Role** — Stored in the signed `admin_grants` table (RS256 over the grant), bootstrapped once from `IMI_ADMIN_EMAILS`, then extended only via 4-eyes promotion
- **TOTP Re-confirmation** — Required for approve/reject and all admin writes

## Transport Security

- **Helmet.js** — CSP, HSTS, X-Frame-Options on all routes
- **CORS** — Restricted to own domain
- **Cookies** — httpOnly, secure, sameSite=strict

## Bundle Security

- **RS256 Signing** — Every FHIR Bundle is signed with the server's private key (`X-Bundle-Signature` header)
- **Content Hash** — SHA-256 hash of bundle content logged in audit trail (`X-Content-Hash` header)
- **mTLS** — DSF processes authenticate via client certificate thumbprint

## Hardening

- **Audit immutability** — `audit_logs` is append-only at the database level via `BEFORE UPDATE`/`BEFORE DELETE` triggers (migration 013), not just by convention
- **CA blacklist** — Certificate uploads issued by a distrusted CA (subject DN / fingerprint) are rejected with `CA_BLACKLISTED`
- **PEM size cap** — Uploaded PEM is capped (20 KB) so oversized input cannot tie up the parser
- **Redis fail-soft** — The idle-timeout check distinguishes a missing activity key from Redis being unreachable, so a transient Redis blip does not log every user out
- **Bundle key id** — Bundle signatures carry a `kid` header so consumers can verify offline and keys can rotate

## Data Protection (GDPR/DSGVO)

- Contact data (name, email, phone) is NEVER included in FHIR bundles
- Organization email is stripped from approval snapshots
- PEM content of private keys is never logged
- Audit log is append-only (no UPDATE/DELETE)

---

For the full threat model see the root [`SECURITY.md`](https://github.com/Mukeyii/num-dsf-allowlist/blob/main/SECURITY.md); for the rationale behind these choices see the [ADRs](https://github.com/Mukeyii/num-dsf-allowlist/tree/main/docs/adr).
