/**
 * rateLimit.middleware.ts – Rate limiting configuration
 * Dependencies: express-rate-limit, rate-limit-redis, ioredis
 *
 * Auth routes: 5 req / 15 min per IP
 * API routes: 100 req / 1 min per user
 */
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../services/redis.service';
import { verifyAccessToken } from '../services/auth.service';

function createRedisStore(prefix: string) {
  return new RedisStore({
    prefix: `ratelimit:${prefix}:`,
    sendCommand: (...args: string[]) => (redis as any).call(...args),
  } as any);
}

export const otpRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_OTP_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_OTP_MAX || '5'),
  store: createRedisStore('otp'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait 15 minutes.' },
  },
});

// Session-maintenance limiter for /auth/refresh — a generous, SEPARATE bucket.
// Refresh is routine (access tokens expire every ~15 min, multiplied by open
// tabs), not a credential attempt, so it must not share the tight 5/15min OTP
// bucket — otherwise a logged-in user 429s themselves mid-session.
export const refreshRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_REFRESH_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_REFRESH_MAX || '60'),
  store: createRedisStore('refresh'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment.' },
  },
});

// Step-up brute-force guard for the 6-digit TOTP on admin write routes. These
// run after requireAuth, so req.user is set and we key per admin. Sized for
// legitimate multi-action admin work (locking several users, reviewing a batch
// of promotions) while still bounding how many guesses a stolen access token
// can make against the rotating 6-digit code.
export const stepUpTotpRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_STEPUP_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_STEPUP_MAX || '20'),
  store: createRedisStore('stepup'),
  keyGenerator: (req) => `user:${(req as { user?: { id: string } }).user?.id || req.ip}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait.' } },
});

export const apiRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_API_MAX || '100'),
  store: createRedisStore('api'),
  // This limiter is mounted at the app level (on /api) BEFORE any router's
  // requireAuth runs, so req.user is not yet set. Decode the bearer token here
  // to key by user id; otherwise the documented "100/min per user" cap silently
  // degrades to per-IP, letting users behind one NAT throttle each other while
  // a single user rotating IPs gets unlimited throughput. Fall back to IP for
  // unauthenticated or invalid-token requests.
  keyGenerator: (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        return `user:${verifyAccessToken(authHeader.slice(7)).sub}`;
      } catch {
        /* invalid/expired token — fall through to IP keying */
      }
    }
    return req.ip || 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
});
