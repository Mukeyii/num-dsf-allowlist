# ADR-013 — Fail-soft refresh idle check on Redis outage

- Status: Accepted
- Date: 2026-06-02
- Deciders: IMI Münster team

## Context

The portal enforces an idle timeout: `/auth/refresh` rejects a refresh when the
user has been inactive. Activity is tracked by an `activity:{userId}` heartbeat
in Redis (ADR-011), refreshed by the auth middleware. A **missing** heartbeat
legitimately means the idle window lapsed, so the session should end. But the
read can also fail because Redis itself is unreachable. Treating a transient
Redis blip as "everyone is idle" would log out every active user at once — an
availability failure triggered by a momentary dependency outage.

## Decision

`refreshAccessToken` (`backend/src/services/auth.service.ts`) distinguishes
"missing key" from "Redis down". It reads `activity:{userId}` inside a try/catch:

- If the read **succeeds** and the key is absent, the user is genuinely idle →
  delete the refresh token and throw `SESSION_EXPIRED`.
- If the read **throws** (Redis unreachable), set `redisReachable = false`, log
  a warning, and **fail soft** — allow the refresh to proceed.

Only the `redisReachable && !lastActivity` combination triggers logout. (The
idle check is also skipped under `NODE_ENV=test`.)

## Consequences

Positive:

- A transient Redis outage no longer mass-revokes active sessions; users stay
  logged in through a brief blip.
- A real idle timeout (heartbeat expired while Redis is healthy) still ends the
  session as intended.

Negative:

- While Redis is down, the idle-timeout control is not enforced, so a genuinely
  idle session could refresh during the outage — a deliberate
  availability-over-strictness trade-off for this window.
- The behaviour relies on the Redis client surfacing unreachability as a thrown
  error distinct from a successful "key not found".
