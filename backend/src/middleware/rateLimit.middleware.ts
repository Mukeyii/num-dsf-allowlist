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

export const apiRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_API_MAX || '100'),
  store: createRedisStore('api'),
  keyGenerator: (req) => (req as any).user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
});
