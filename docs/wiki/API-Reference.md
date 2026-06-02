# API Reference

This document enumerates every HTTP endpoint exposed by the backend (`backend/src/routes/*.ts`), mounted as configured in `backend/src/app.ts`.

All successful JSON responses use the envelope `{ data, error, meta }` (`error` is `null` on success, `meta` is present only where noted). Error responses are `{ error: { code, message, details? } }`. Validation failures return `400` with `code: "VALIDATION"`; unknown routes return `404` with `code: "NOT_FOUND"`.

## Auth column legend

| Marker | Meaning |
|--------|---------|
| public | No middleware; open endpoint (OTP-rate-limited where noted) |
| requireAuth | Valid JWT Bearer access token |
| requireAdmin | `requireAuth` + `requireImiAdmin` (IMI operator) |
| requireOwner | `requireAuth` + `requireInstanceOwnership` (caller owns `:instanceId`, or is admin) |
| requireTotp | A valid live TOTP code in the body (in addition to the JWT) |
| mTLS | Client-certificate thumbprint match (no JWT) |

---

## Auth

Mounted at `/auth`. All endpoints are `public` and Redis-rate-limited (5 req / 15 min per IP), except where the limiter is skipped in test/dev.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /auth/request-otp | public | Send a 6-digit OTP by email if the address is whitelisted. Always 200 (no enumeration). |
| POST | /auth/verify-otp | public | Verify OTP, return a short-lived `tempToken`. |
| POST | /auth/setup-totp | public | First login: return TOTP QR code. Refuses (409) if TOTP already enabled. |
| POST | /auth/confirm-totp | public | Confirm TOTP after setup, create session, return access token + backup codes. |
| POST | /auth/verify-totp | public | Verify TOTP on subsequent logins, create session. |
| POST | /auth/refresh | public | Exchange refresh-token cookie for a new access token. |
| POST | /auth/client-cert-login | mTLS | Authenticate by registered client-certificate thumbprint, create session. |
| POST | /auth/logout | public | Revoke refresh token (Redis) and clear cookie. |
| POST | /auth/dev-login | public | Dev/CI only — registered solely when `NODE_ENV != production` and `DEV_AUTO_LOGIN=true`; otherwise 404. |
| GET | /auth/me | requireAuth | Return `{ email, isAdmin }` of the current user. |

Notes:
- `request-otp` body `{ email }`; `verify-otp` body `{ email, code }` → `{ tempToken }`.
- `setup-totp` body `{ tempToken }` → `{ qrCodeUrl }` (secret is never returned).
- `confirm-totp` / `verify-totp` body `{ tempToken, code }` → `{ accessToken, backupCodes? }`; refresh token set as httpOnly cookie scoped to `/auth`.
- `refresh` reads the `refreshToken` cookie → `{ accessToken }`.

---

## Instances

Mounted at `/api/v1/instances`. All endpoints `requireAuth`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/instances | requireAuth | List instances owned by the user (admins see all). |
| POST | /api/v1/instances | requireAuth | Create a new instance (201). |
| GET | /api/v1/instances/:id | requireAuth | Fetch a single instance (404 if not visible). |
| PUT | /api/v1/instances/:id/label | requireAuth | Rename instance. Body `{ label }` (1–255 chars); 403 if not owner. |

---

## Organization

Mounted at `/api/v1/instances/:instanceId/organization`. All endpoints `requireOwner`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/instances/:instanceId/organization | requireOwner | Get the organization for the instance. |
| PUT | /api/v1/instances/:instanceId/organization | requireOwner | Upsert the organization. |
| POST | /api/v1/instances/:instanceId/organization/request-removal | requireOwner | Submit a removal approval request. |

PUT body (`upsertOrganizationSchema`): `{ identifier (FQDN), name, email, active?, addressLine?, postalCode?, city?, countryCode?, clientCertThumbprint?, totpCode? }`. Changing `clientCertThumbprint` on your own org requires a 6-digit `totpCode` (else `TOTP_REQUIRED`/`TOTP_INVALID`). An admin editing another user's org cannot modify the thumbprint (`FORBIDDEN_THUMBPRINT_WRITE`).

---

## Contacts

Mounted at `/api/v1/instances/:instanceId/contacts`. All endpoints `requireOwner`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/instances/:instanceId/contacts | requireOwner | List contacts. |
| POST | /api/v1/instances/:instanceId/contacts | requireOwner | Create a contact (201). |
| PUT | /api/v1/instances/:instanceId/contacts/:cid | requireOwner | Update a contact. |
| DELETE | /api/v1/instances/:instanceId/contacts/:cid | requireOwner | Delete a contact → `{ deleted: true }`. |
| POST | /api/v1/instances/:instanceId/contacts/:cid/resend-verification | requireOwner | Re-send the email-verification message. |

Create/update body (`createContactSchema`): `{ types: ["MEDIC"|"DSF_ADMIN"|"SECURITY"] (≥1), email, name?, phone?, addressLine?, city?, postalCode?, countryCode? }`.

---

## Endpoints

Mounted at `/api/v1/instances/:instanceId/endpoints`. All endpoints `requireOwner`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/instances/:instanceId/endpoints | requireOwner | List endpoints. |
| POST | /api/v1/instances/:instanceId/endpoints | requireOwner | Create an endpoint (201). |
| PUT | /api/v1/instances/:instanceId/endpoints/:eid | requireOwner | Update an endpoint. |
| DELETE | /api/v1/instances/:instanceId/endpoints/:eid | requireOwner | Delete an endpoint → `{ deleted: true }`. |

Create body (`createEndpointSchema`): `{ identifier, address (URL), name?, ipAddresses?: [{ ip (IPv4), isFhir?, isBpe? }] }`. Update body is the same fields, all optional.

---

## Certificates

Mounted at `/api/v1/instances/:instanceId/certificates`. All endpoints `requireOwner`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/instances/:instanceId/certificates | requireOwner | List certificates. |
| GET | /api/v1/instances/:instanceId/certificates/expiring | requireOwner | Certificates expiring within 90 days. |
| POST | /api/v1/instances/:instanceId/certificates | requireOwner | Upload a PEM certificate (201). |
| DELETE | /api/v1/instances/:instanceId/certificates/:cid | requireOwner | Delete a certificate → `{ deleted: true }`. |
| POST | /api/v1/instances/:instanceId/certificates/:cid/renew | requireOwner | Replace/renew a certificate's PEM. |

POST body (`createCertificateSchema`): `{ pem }` — must contain `-----BEGIN CERTIFICATE-----`. PEM containing private-key material is rejected with `400 PRIVATE_KEY_REJECTED`; PEM content is never logged.

---

## Memberships

Mounted at `/api/v1/instances/:instanceId/memberships`. All endpoints `requireOwner`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/instances/:instanceId/memberships | requireOwner | List memberships. |
| POST | /api/v1/instances/:instanceId/memberships | requireOwner | Create a membership (201). |
| PUT | /api/v1/instances/:instanceId/memberships/:mid | requireOwner | Update a membership. |
| DELETE | /api/v1/instances/:instanceId/memberships/:mid | requireOwner | Soft-delete a membership → `{ deleted: true }`. |

Create body (`createMembershipSchema`): `{ parentOrganization, endpointId, roles: ["DIC"|"HRP"|"DMS"|"AMS"] (≥1) }`. Update fields all optional.

---

## Approval (tenant side)

Mounted at `/api/v1/instances/:instanceId/approval`. All endpoints `requireOwner`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/v1/instances/:instanceId/approval/submit | requireOwner | Submit the instance for approval. |
| GET | /api/v1/instances/:instanceId/approval/status | requireOwner | Current approval status. |
| GET | /api/v1/instances/:instanceId/approval/history | requireOwner | Approval-request history. |

---

## Admin

### Approval

Mounted at `/api/v1/admin/approval`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/admin/approval/pending | requireAdmin | List pending requests, enriched with collected signatures. |
| POST | /api/v1/admin/approval/:rid/approve | requireAdmin + requireTotp | Approve a request (4-eyes; same-site/double-decision guarded). Body `{ totpCode }`. |
| POST | /api/v1/admin/approval/:rid/reject | requireAdmin + requireTotp | Reject a request. Body `{ totpCode, comment? }`. |

### Users (whitelist)

Mounted at `/api/v1/admin/users`. All `requireAdmin`; writes also `requireTotp`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/admin/users | requireAdmin | List whitelist entries + admin grants. |
| POST | /api/v1/admin/users | requireAdmin + requireTotp | Add an email to the whitelist. Body `{ email, totpCode }` (201). |
| POST | /api/v1/admin/users/:email/lock | requireAdmin + requireTotp | Lock an account. Body `{ reason?, totpCode }`. |
| POST | /api/v1/admin/users/:email/unlock | requireAdmin + requireTotp | Unlock an account. Body `{ totpCode }`. |
| POST | /api/v1/admin/users/:email/demote | requireAdmin + requireTotp | Remove admin grant. Body `{ totpCode }`. |
| DELETE | /api/v1/admin/users/:email | requireAdmin + requireTotp | Remove from whitelist. Body `{ totpCode }`. |

### Promotions (4-eyes admin grants)

Mounted at `/api/v1/admin/promotions`. All `requireAdmin`; writes also `requireTotp`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/admin/promotions | requireAdmin | List pending promotion requests. |
| POST | /api/v1/admin/promotions | requireAdmin + requireTotp | Create a promotion request. Body `{ targetEmail, totpCode }` (201). |
| POST | /api/v1/admin/promotions/:id/approve | requireAdmin + requireTotp | Approve (must be a different admin from a different site). Body `{ totpCode }`. |
| POST | /api/v1/admin/promotions/:id/reject | requireAdmin + requireTotp | Reject. Body `{ reason?, totpCode }`. |
| POST | /api/v1/admin/promotions/:id/cancel | requireAdmin + requireTotp | Cancel a pending request. Body `{ totpCode }`. |

### CA Blacklist

Mounted at `/api/v1/admin/ca-blacklist`. All `requireAdmin`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/admin/ca-blacklist | requireAdmin | Return `{ blacklist, knownCas }` (known CAs = Mozilla cache picker). |
| POST | /api/v1/admin/ca-blacklist | requireAdmin | Add an entry. Body `{ subjectDn, fingerprint? (64-hex), reason? }` → `{ id }` (201). |
| DELETE | /api/v1/admin/ca-blacklist/:id | requireAdmin | Remove an entry → `{ deleted: true }`. |

### Bundle Versions

Mounted at `/api/v1/admin/bundle-versions`. All `requireAdmin`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/admin/bundle-versions | requireAdmin | Paginated bundle history (`?page=&limit=`); includes `meta` pagination. |
| GET | /api/v1/admin/bundle-versions/:id | requireAdmin | Single version + parsed bundle. |
| GET | /api/v1/admin/bundle-versions/:id/download | requireAdmin | Raw bundle JSON as attachment (signature + content-hash headers). |
| GET | /api/v1/admin/bundle-versions/:idA/diff/:idB | requireAdmin | Diff between two versions. |

### Approval / Audit / Instances (admin.routes)

Mounted at `/api/v1/admin`. All `requireAdmin`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/admin/instances | requireAdmin | List all instances (cross-tenant). |
| GET | /api/v1/admin/audit | requireAdmin | Paginated cross-instance audit log (`?page=&limit=`); includes `meta` pagination. |

### Marketplace (admin writes)

Mounted at `/api/v1/admin/marketplace`. All `requireAdmin`; writes also `requireTotp`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/v1/admin/marketplace | requireAdmin + requireTotp | Add an entry. Body `{ gitUrl, status?, totpCode }` (201, 409 on duplicate). |
| PATCH | /api/v1/admin/marketplace/:id | requireAdmin + requireTotp | Update status. Body `{ status, totpCode }`. |
| DELETE | /api/v1/admin/marketplace/:id | requireAdmin + requireTotp | Remove an entry. Body `{ totpCode }` → `{ deleted: true }`. |

`gitUrl` must be `https://github.com/owner/repo`; `status` ∈ `APPROVED|EXPERIMENTAL|DEPRECATED`.

---

## Marketplace (read)

Mounted at `/api/v1/marketplace`. `requireAuth`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/marketplace | requireAuth | List marketplace entries. |

---

## Network

Mounted at `/api/v1/network`. `requireAuth`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/network/map | requireAuth | Cross-instance allow-list map; `meta.isAdmin` flags admin scope. |

---

## Audit (cross-instance)

Mounted at `/api/v1/audit` (per-instance audit lives under each instance — see below).

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/audit | requireAuth | Cross-instance audit log; admins see all rows, non-admins only their own instances. `?page=&limit=` (limit ≤ 200), `meta` pagination. |
| GET | /api/v1/instances/:instanceId/audit | requireOwner | Per-instance audit log. Query `?page=&limit=&resource=&operation=`, `meta` pagination. |

---

## Download

Mounted at `/api/v1/instances/:instanceId/download` and `/api/v1/download`.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/v1/instances/:instanceId/download/full-bundle | requireAuth | Network-wide FHIR bundle (audited). Returns `application/fhir+json` attachment. |
| GET | /api/v1/instances/:instanceId/download/bundle | requireOwner | Per-endpoint signed bundle. Query `?endpointId=` (required). Signature + content-hash headers. |
| GET | /api/v1/instances/:instanceId/download/ip-address-list | requireAdmin | Excel (`.xlsx`) export of all allow-listed IPs. |
| GET | /api/v1/download/ip-address-list | requireAdmin | Same export without instance scope. |
| GET | /api/v1/download/full-bundle | requireAuth | Network-wide bundle without instance scope. |
| GET | /api/v1/download/bundle | requireOwner | Bundle route also reachable without instance scope (requires `endpointId`). |

Note: the `downloadRouter` is mounted twice — under `/api/v1/instances/:instanceId/download` and `/api/v1/download` — so all three handlers (`full-bundle`, `bundle`, `ip-address-list`) exist under both prefixes. `bundle`/`ip-address-list` paths under `/api/v1/download` lack an `:instanceId`, so `requireInstanceOwnership`/scoped lookups behave accordingly.

---

## FHIR

Mounted at `/fhir`. Machine-to-machine; authenticated by client-certificate thumbprint (mTLS), no JWT. Errors are FHIR `OperationOutcome` resources, not the `{ error }` envelope.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /fhir/Bundle/:endpointId | mTLS | Fetch the signed bundle for one endpoint owned by the calling cert's org. |
| GET | /fhir/Bundle | mTLS | Search by client cert; returns the network-wide bundle. |

Missing cert → 401; cert not registered → 403; unknown endpoint/org → 404.

---

## Health

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /health | public | Liveness — always `{ status: "ok" }`. |
| GET | /health/live | public | Liveness alias. |
| GET | /health/ready | public | Readiness — checks DB + Redis; 503 if degraded. |
