# ADR-005 — Certificate-auth deployment mode (login-screen-free)

- Status: Accepted
- Date: 2026-06-23
- Deciders: IMI Münster team

## Context

The portal's interactive auth (email allow-list + OTP + TOTP → short-lived JWT)
is designed for IMI operators. Participating sites asked for the behaviour of the
previous allow-list tool: reach the platform **without a login screen**, gated by
a reverse proxy that performs client-certificate authentication, where the
certificate must already be in the allow-list.

Most of the machinery already exists and is reused unchanged:

- nginx terminates TLS and forwards the client cert (`X-Client-Cert` /
  `X-Client-Verify`) to `/auth`, `/api`, `/fhir` — see `nginx/nginx.prod.conf`.
- `POST /auth/client-cert-login` (`backend/src/routes/auth.routes.ts`) requires
  `X-Client-Verify: SUCCESS`, computes the cert SHA-256 thumbprint
  (`backend/src/lib/clientCert.ts`), looks up the organization by
  `organizations.client_cert_thumbprint`, validates instance → owner user →
  allow-list/not-locked, and mints the normal JWT + refresh-cookie session,
  bypassing OTP/TOTP. Audited as a `LOGIN`.
- The frontend wrapper `authApi.clientCertLogin()` already exists
  (`frontend/src/api/auth.api.ts`).
- The login certificate is designated per organization via the existing
  `organizations.client_cert_thumbprint` field (set in the Organization modal),
  separate from the machine/federation certs in the `certificates` table.

This ADR therefore adds a **deployment variant and the frontend wiring**, not a
new authentication mechanism.

## Decision

### 1. A separate, site-facing deployment variant

`docker-compose.cert-auth.yml` mirrors `docker-compose.prod.yml` with two
differences: the frontend image is built with `VITE_AUTH_MODE=cert`, and nginx
mounts `nginx/nginx.cert-auth.conf`. The standard OTP/TOTP deployment
(`docker-compose.prod.yml`) is left untouched; IMI operators continue to use it.
The two variants run as independent stacks.

### 2. Identity = the org's designated login certificate

Authentication uses the existing `/auth/client-cert-login` unchanged: the
presented cert's thumbprint must equal an `organizations.client_cert_thumbprint`,
and the session is minted for that organization's instance-owner user. One
designated login cert per organization. Machine/federation certs in the
`certificates` table do **not** grant login.

### 3. Enforcement is by the allow-list, not a CA

DSF site certificates are self-signed leaf certs with no common CA, so a hard
`ssl_verify_client on` with a CA bundle is not viable. "Enforced" therefore means:

- nginx keeps `ssl_verify_client optional_no_ca` (the cert is requested; a
  self-signed cert completes the handshake and is forwarded to the backend).
- The **authoritative gate** is the thumbprint match against the allow-list in
  the backend — exactly "the certificate must already be in the allow-list".
- The cert-mode frontend exposes **no OTP path**, and `nginx.cert-auth.conf`
  additionally **denies the OTP/TOTP endpoints** (`/auth/request-otp`,
  `/auth/verify-otp`, `/auth/verify-totp`, `/auth/setup-totp`,
  `/auth/confirm-totp`) with `403`, so OTP cannot be used even by a crafted
  request. Only `/auth/client-cert-login`, `/auth/refresh`, `/auth/logout`,
  `/auth/me` remain.

### 4. Frontend cert mode (`VITE_AUTH_MODE=cert`)

- `AuthBootstrap` (`frontend/src/components/AuthBootstrap.tsx`): on mount, try
  `refresh()`; on failure, in cert mode call `authApi.clientCertLogin()`. Success
  → `setTokens` → app. Failure → render a dedicated **CertStatusPage** (not the
  OTP login), keyed by the backend error code (`NO_CLIENT_CERT`,
  `CERT_NOT_REGISTERED`, `NO_INSTANCE`, `NO_USER`, `ACCOUNT_LOCKED`).
- Idle timeout in cert mode re-attempts `clientCertLogin()` rather than
  redirecting to `/login`.
- Router (`frontend/src/router.tsx`): in cert mode the OTP routes (`/login`,
  `/otp`, `/totp`, `/totp-setup`) redirect to the cert-status route; `RequireAuth`
  is unchanged (AuthBootstrap owns the unauthenticated UX in cert mode).
- `VITE_AUTH_MODE` is declared in `frontend/src/vite-env.d.ts` and read via
  `import.meta.env`; default/absent = the existing OTP behaviour.

### Components (file-level)

New:
- `docker-compose.cert-auth.yml`
- `nginx/nginx.cert-auth.conf`
- `frontend/src/pages/CertStatusPage.tsx` (+ test)
- i18n keys for the cert-status states (en.ts + de.ts)
- `docs/DEPLOYMENT.md` section for the cert-auth variant

Modified:
- `frontend/src/components/AuthBootstrap.tsx` — cert-mode branch
- `frontend/src/router.tsx` — cert-mode redirects + cert-status route
- `frontend/src/vite-env.d.ts` — `VITE_AUTH_MODE`
- `frontend/Dockerfile` — accept `VITE_AUTH_MODE` build arg (mirrors `VITE_API_URL`)

Unchanged (reused): the backend `/auth/client-cert-login` endpoint,
`clientCert.ts`, `organizations.client_cert_thumbprint`, `authApi.clientCertLogin`.

## Consequences

Positive:

- Sites reach the portal with no login screen using the same X.509 material the
  federation already provisions; no second credential system.
- The standard OTP/TOTP deployment and all admin flows are untouched — zero risk
  to current behaviour; the variant is additive.
- "No OTP" is enforced at the proxy (denied endpoints), not merely hidden in the
  UI.

Negative:

- The backend trusts the cert headers nginx injects, so security depends on nginx
  being the only ingress and on `optional_no_ca` + the thumbprint gate; a
  mis-deployed proxy that forwards forged headers would be a bypass (same trust
  model as ADR-004).
- One login cert per org; a rotated cert must be re-designated in
  `organizations.client_cert_thumbprint`.
- Browser client-cert selection UX is OS/keystore-driven and outside the app's
  control; a user with no cert installed gets a TLS-level prompt/failure before
  the SPA loads.

## Out of scope (YAGNI)

- Admin login via certificate (admins use the OTP deployment).
- Multiple login certs per organization, or login via any `certificates`-table
  entry.
- A common CA / CRL / OCSP enforcement at nginx.
- A runtime auth-mode toggle within a single deployment.
