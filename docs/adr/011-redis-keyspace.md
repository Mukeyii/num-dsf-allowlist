# ADR-011 — Redis keyspace layout and TTLs

- Status: Accepted
- Date: 2026-06-02
- Deciders: IMI Münster team

## Context

Redis backs several short-lived, security-sensitive pieces of state: pending
OTPs, refresh tokens, rate-limit counters, TOTP anti-replay markers, and an
activity heartbeat. Mixing these without a disciplined naming and TTL scheme
makes it hard to reason about expiry, to scan a single category (e.g. revoke a
user's sessions), and to keep secrets from outliving their purpose.

## Decision

A documented prefix-per-concern keyspace, declared in the header of
`backend/src/services/redis.service.ts`:

| Prefix | Contents | TTL | Rationale |
|--------|----------|-----|-----------|
| `otp:{email}` | SHA-256 hash of the pending 6-digit OTP | 10 min | Short login window; single-use, deleted on verify (ADR-006). |
| `refresh:{tokenHash}` | userId for an active refresh token | 7 d | Session lifetime; only the SHA-256 hash is stored, so a keyspace dump yields no usable token. |
| `ratelimit:{ip\|key}` | express-rate-limit counters | per limiter window | Redis store so limits hold across backend instances. |
| `totp_used:{sha256}` | anti-replay marker for a consumed TOTP code | 120 s | Must outlast the ±1-step (≈90 s) acceptance window so a captured code cannot be re-submitted (`totp.service.ts`). |
| `activity:{userId}` | last-activity heartbeat | idle window | Drives the refresh idle-timeout check; refreshed by auth middleware. |

Refresh tokens carry no per-user index, so session revocation `SCAN`s
`refresh:*` (in cursor-paged batches, not `KEYS`) and deletes keys whose value
matches the userId (`revokeAllSessions` in `auth.service.ts`).

## Consequences

Positive:

- Each category has an explicit prefix and an expiry tuned to its security
  window, so secrets self-expire and a single concern can be scanned in
  isolation.
- Storing only hashes for OTP and refresh tokens means a Redis dump does not
  directly yield usable credentials.

Negative:

- The absence of a per-user refresh index forces an O(N) `SCAN` over
  `refresh:*` to revoke a user's sessions (mitigated by cursor-paged `SCAN`
  rather than blocking `KEYS`).
- Correct security depends on the TTLs staying coupled to their windows — e.g.
  the TOTP anti-replay TTL must remain ≥ the acceptance window.
