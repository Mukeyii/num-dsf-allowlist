# ADR-006 — Passwordless authentication (allow-list + OTP + TOTP)

- Status: Accepted
- Date: 2026-06-02
- Deciders: IMI Münster team

## Context

The portal is operated by a small, known set of IMI admins. Passwords for such
a team add a credential to phish, reuse, and breach without adding much value
over factors the admins already control (their mailbox and an authenticator
app). The portal also gates federation-critical actions, so authentication must
be multi-factor and the login surface must reveal nothing about which addresses
are valid.

## Decision

There are no passwords. Login is a three-stage passwordless flow
(`backend/src/services/auth.service.ts`):

1. **Email allow-list.** `requestOtp` checks the address against
   `email_whitelist`; a non-listed or locked address returns a generic
   `NOT_WHITELISTED` error that does not reveal whether the email exists.
2. **OTP.** A 6-digit code generated with `crypto.randomInt`, stored in Redis as
   a SHA-256 hash under `otp:{email}` with a 600 s TTL, single-use — deleted on
   every verify attempt and compared with `crypto.timingSafeEqual`
   (`otp.service.ts`). Plaintext is never persisted.
3. **TOTP 2FA.** On first login the user sets up a TOTP secret (speakeasy,
   AES-256-GCM-encrypted in the DB); thereafter `verifyTotpCode` checks the code
   with a 1-step window and an anti-replay marker, or a bcrypt-hashed single-use
   backup code is accepted (`totp.service.ts`).

Success yields an RS256 JWT plus a refresh token whose SHA-256 hash is stored in
Redis. Each stage writes an audit-log entry.

## Consequences

Positive:

- No password to phish, reuse, or leak; two independent factors (mailbox
  possession + authenticator) are required.
- The generic allow-list error avoids account/email enumeration.
- OTP secrets never touch persistent storage in plaintext; codes are single-use
  and time-boxed.

Negative:

- Account recovery and availability depend on the user's mailbox and
  authenticator device; loss of both requires backup codes or admin
  intervention.
- The flow adds email-delivery and TOTP-setup steps and several round trips
  compared with a single password prompt.
