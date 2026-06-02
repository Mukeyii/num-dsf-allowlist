# Redis Key Prefixes

Connection via `REDIS_URL` (`backend/src/services/redis.service.ts`). All keys are namespaced by prefix.

| Prefix | Key form | Purpose | TTL | Source |
|---|---|---|---|---|
| `otp:` | `otp:{email}` | Pending login OTP (SHA-256 hashed code), deleted on verify | 600 s (10 min); default in `setOtp` | redis.service.ts |
| `refresh:` | `refresh:{tokenHash}` | Active refresh token → userId; deleted on logout | passed in (refresh-token lifetime, 7 d) | redis.service.ts |
| `ratelimit:` | `ratelimit:{prefix}:{ip\|key}` | express-rate-limit Redis store; per-route prefix | managed by rate-limit window | middleware/rateLimit.middleware.ts |
| `totp_used:` | `totp_used:{sha256(userId:code)}` | TOTP anti-replay window; set with `NX` on first use | 120 s (`EX 120` in code) | services/totp.service.ts |
| `activity:` | `activity:{userId}` | Last-activity heartbeat for idle-timeout enforcement | `IDLE_TIMEOUT_MS` (default 1 800 000 ms = 30 min) | middleware/auth.middleware.ts, services/auth.service.ts |

Notes:
- The `redis.service.ts` header comments `totp_used` as TTL 60 s, but the implementation in `totp.service.ts` uses `EX 120` (120 s). The code value is authoritative.
- The `activity:` TTL is refreshed on each authenticated request by the auth middleware.
