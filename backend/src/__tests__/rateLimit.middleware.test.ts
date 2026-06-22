/**
 * rateLimit.middleware.test.ts — unit-level coverage of the express-rate-limit
 * limiters backed by the real Redis store.
 *
 * Each limiter is mounted on a throwaway Express app + supertest so we exercise
 * the actual middleware (keyGenerator, Redis store increment, 429 handler)
 * rather than the route stack it normally protects.
 *
 *   • otpRateLimit — keyed by client IP. With `trust proxy` on, a UNIQUE
 *     X-Forwarded-For gives this test its own Redis bucket. Requests under the
 *     configured cap pass (200); the request that exceeds it returns 429 with
 *     the documented RATE_LIMITED error shape and standard rate-limit headers.
 *   • apiRateLimit — custom keyGenerator decodes the Bearer token and keys by
 *     `user:<sub>`. Two DIFFERENT users (distinct JWTs) increment independent
 *     buckets, so one user's traffic never throttles another's.
 *
 * The configured cap is read from the same env var the middleware reads
 * (RATE_LIMIT_OTP_MAX) so the assertions track however the container is sized.
 *
 * Cleanup: every `ratelimit:*` Redis key this suite touches is tracked and
 * deleted in afterAll. No DB rows are created.
 *
 * Dependencies: supertest, express, uuid, jsonwebtoken, redis.service,
 * rateLimit.middleware.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../services/redis.service';
import { otpRateLimit, apiRateLimit } from '../middleware/rateLimit.middleware';

// Effective OTP cap — the middleware reads this exact env at import time.
const OTP_MAX = parseInt(process.env.RATE_LIMIT_OTP_MAX || '5', 10);

// Mints a valid RS256 access token whose `sub` the apiRateLimit keyGenerator
// will read (it calls verifyAccessToken). Distinct sub ⇒ distinct bucket.
function mintToken(userId: string): string {
  const privateKey = Buffer.from(process.env.JWT_PRIVATE_KEY_BASE64 || '', 'base64').toString(
    'utf8',
  );
  return jwt.sign({ sub: userId, email: `${userId}@rl-test.de` }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
  });
}

// Redis keys this suite creates, so afterAll can purge exactly them.
const touchedKeys = new Set<string>();
const otpKey = (ip: string): string => `ratelimit:otp:${ip}`;
const apiKey = (userId: string): string => `ratelimit:api:user:${userId}`;

function buildApp(limiter: express.RequestHandler): Express {
  const app = express();
  // The default IP keyGenerator honours X-Forwarded-For only behind a trusted
  // proxy; without this every request would key on the test socket's loopback.
  // Trust exactly one hop (a number, not `true`) so express-rate-limit's
  // permissive-trust-proxy validator stays quiet — `true` would trip it.
  app.set('trust proxy', 1);
  app.use(express.json());
  app.get('/probe', limiter, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe('rateLimit.middleware', () => {
  afterAll(async () => {
    const keys = [...touchedKeys];
    if (keys.length) await redis.del(...keys);
  });

  describe('otpRateLimit (IP-keyed)', () => {
    it('lets requests under the cap through, then 429s the one that exceeds it', async () => {
      // Unique IP ⇒ a fresh Redis bucket nothing else in the suite can pollute.
      const ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`;
      touchedKeys.add(otpKey(ip));
      const app = buildApp(otpRateLimit);

      // Exactly `OTP_MAX` requests are allowed.
      for (let i = 0; i < OTP_MAX; i++) {
        const res = await request(app).get('/probe').set('X-Forwarded-For', ip);
        expect(res.status).toBe(200);
      }

      // The (OTP_MAX + 1)-th in the same window is rejected.
      const blocked = await request(app).get('/probe').set('X-Forwarded-For', ip);
      expect(blocked.status).toBe(429);
      // Documented error envelope.
      expect(blocked.body).toEqual({
        error: { code: 'RATE_LIMITED', message: expect.any(String) },
      });
      // standardHeaders: true ⇒ RateLimit-* present, legacy X-RateLimit-* absent.
      expect(blocked.headers).toHaveProperty('ratelimit-remaining');
      expect(blocked.headers['x-ratelimit-remaining']).toBeUndefined();
    });

    it('keeps a different IP in its own bucket (no cross-IP bleed)', async () => {
      const ipA = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
      const ipB = `198.51.100.${Math.floor(Math.random() * 250) + 1 + 1}`;
      touchedKeys.add(otpKey(ipA));
      touchedKeys.add(otpKey(ipB));
      const app = buildApp(otpRateLimit);

      // Exhaust ipA up to and over the cap.
      for (let i = 0; i < OTP_MAX; i++) {
        await request(app).get('/probe').set('X-Forwarded-For', ipA);
      }
      const blockedA = await request(app).get('/probe').set('X-Forwarded-For', ipA);
      expect(blockedA.status).toBe(429);

      // A fresh IP is unaffected by ipA's exhaustion.
      const freshB = await request(app).get('/probe').set('X-Forwarded-For', ipB);
      expect(freshB.status).toBe(200);
    });
  });

  describe('apiRateLimit (token-keyed)', () => {
    it('keys distinct authenticated users into independent buckets', async () => {
      const userA = uuidv4();
      const userB = uuidv4();
      touchedKeys.add(apiKey(userA));
      touchedKeys.add(apiKey(userB));
      const app = buildApp(apiRateLimit);

      // A handful of calls as user A — far below the API cap, all 200.
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .get('/probe')
          .set('Authorization', `Bearer ${mintToken(userA)}`);
        expect(res.status).toBe(200);
      }
      // User B starts clean: its remaining count is not depleted by user A.
      const resB = await request(app)
        .get('/probe')
        .set('Authorization', `Bearer ${mintToken(userB)}`);
      expect(resB.status).toBe(200);

      // Both buckets were created under the per-user prefix — proving the custom
      // keyGenerator decoded the token rather than falling back to a shared IP.
      expect(await redis.exists(apiKey(userA))).toBe(1);
      expect(await redis.exists(apiKey(userB))).toBe(1);
    });
  });
});
