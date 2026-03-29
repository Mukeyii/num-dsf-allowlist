# Security

## Authentication

- **Passwordless** — No passwords stored. Authentication via email OTP + TOTP 2FA.
- **OTP** — 6-digit code, SHA-256 hashed in Redis, 10-minute TTL, single-use
- **TOTP** — Authenticator app, ±1 step tolerance (30s window)
- **Backup Codes** — 10 codes, bcrypt-hashed, single-use
- **Sessions** — JWT (RS256, 15 min) + httpOnly refresh token cookie (7 days)

## Authorization

- **Rate Limiting** — 5 req/15min on auth endpoints, 100 req/min on API (Redis-backed)
- **Instance Ownership** — Users can only access their own instances
- **Admin Role** — Configured via `IMI_ADMIN_EMAILS` environment variable
- **TOTP Re-confirmation** — Required for approve/reject actions

## Transport Security

- **Helmet.js** — CSP, HSTS, X-Frame-Options on all routes
- **CORS** — Restricted to own domain
- **Cookies** — httpOnly, secure, sameSite=strict

## Bundle Security

- **RS256 Signing** — Every FHIR Bundle is signed with the server's private key (`X-Bundle-Signature` header)
- **Content Hash** — SHA-256 hash of bundle content logged in audit trail (`X-Content-Hash` header)
- **mTLS** — DSF processes authenticate via client certificate thumbprint

## Data Protection (GDPR/DSGVO)

- Contact data (name, email, phone) is NEVER included in FHIR bundles
- Organization email is stripped from approval snapshots
- PEM content of private keys is never logged
- Audit log is append-only (no UPDATE/DELETE)
