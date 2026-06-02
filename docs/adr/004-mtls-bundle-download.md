# ADR-004 — mTLS client-certificate auth for bundle download

- Status: Accepted
- Date: 2026-06-02
- Deciders: IMI Münster team

## Context

A DSF Business Process Engine (BPE) at each participating site must pull the
signed FHIR allow-list bundle automatically, with no human in the loop. The
portal's interactive auth (email allow-list + OTP + TOTP, then a short-lived
JWT) is designed for human admins and cannot be driven by an unattended machine
process. The bundle endpoint therefore needs a machine-to-machine credential
that the federation already provisions.

## Decision

The `/fhir/Bundle` routes (`backend/src/routes/fhir.routes.ts`) authenticate by
client-certificate thumbprint over mTLS — **no JWT**. nginx terminates TLS and
forwards the client certificate to the backend in an `x-client-cert` /
`x-ssl-client-cert` header. `extractClientCert` (`backend/src/lib/clientCert.ts`)
decodes the PEM, strips it to DER, and computes a SHA-256 thumbprint. The route
looks up the organization registered for that thumbprint
(`organizations.client_cert_thumbprint`); a missing cert → 401, an unregistered
cert → 403. `GET /fhir/Bundle/:endpointId` scopes the response to the caller's
own instance and the requested endpoint, so a cert registered for org A cannot
pull org B's endpoint bundle. Downloads are recorded in the audit log with only
a thumbprint prefix and no user email.

## Consequences

Positive:

- BPE processes authenticate with the same X.509 material already used for DSF
  mTLS, avoiding a separate machine-credential system.
- Scoping the per-endpoint bundle to the cert's own instance prevents one site
  from enumerating another's endpoints through this path.

Negative:

- The backend trusts the cert headers nginx injects, so this path's security
  depends on nginx being the only ingress and on its mTLS configuration.
- A thumbprint is only as current as the `organizations` registration; a rotated
  or revoked client cert must be re-registered to keep (or lose) access.
