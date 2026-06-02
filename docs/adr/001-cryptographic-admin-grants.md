# ADR-001 — Cryptographically signed admin grants

- Status: Accepted
- Date: 2026-06-02
- Deciders: IMI Münster team

## Context

Admin authority gates the approval workflow and other privileged actions. If
admin status were a plain boolean column or an unsigned `admin_grants` row, an
attacker who obtained write access to the database alone — a SQL injection, a
stolen `DB_USER` credential, a rogue DBA — could simply insert a row granting
themselves admin and bypass every application-level control. The database must
not be a sufficient trust anchor for privilege escalation.

## Decision

Admin grants are stored in the `admin_grants` table (migration
`006_admin_grants.sql`) with columns `email`, `granted_at`, `granted_by_a`,
`granted_by_b`, and `signature_hex`. Each row carries an RS256 signature over a
canonical message built from those fields:

```
${email}|${granted_at ISO}|${granted_by_a}|${granted_by_b}
```

all lowercased, joined by `|` (see `backend/src/lib/adminGrants.ts`,
`canonicalMessage`). `signGrant` signs the message with `crypto.sign('sha256',
…, PRIVATE_KEY_PEM)`; `verifyGrant` checks it with `crypto.verify` against the
public key. The signing key comes from `ADMIN_GRANT_PRIVATE_KEY_BASE64` (falling
back to `JWT_PRIVATE_KEY_BASE64`); verification uses the corresponding public
key. The two `granted_by` fields encode the two admins who authorised the grant.

## Consequences

Positive:

- A database-only attacker cannot forge a usable admin grant: without the
  private key, any row they insert fails signature verification.
- The `granted_by_a` / `granted_by_b` fields make every grant attributable to
  two named authorisers.

Negative:

- The admin-grant private key becomes critical key material; its compromise
  undermines the whole scheme and key rotation invalidates existing signatures.
- Verification cost (one RS256 verify per grant check) is added to admin-gated
  paths.
- By default the grant key reuses the JWT key pair, so the two concerns share a
  single secret unless the dedicated `ADMIN_GRANT_*` vars are set.
