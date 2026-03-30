/**
 * redis.service.ts – Redis connection and base functions
 * Key prefixes: otp:{email}, refresh:{tokenHash}, ratelimit:{ip}
 * Depends on: REDIS_URL env var
 */
import Redis from 'ioredis';
import { logger } from '../lib/logger';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => logger.error({ err }, 'Redis connection error'));

export async function testRedisConnection(): Promise<void> {
  await redis.ping();
}

// OTP helpers
export async function setOtp(email: string, hashedCode: string, ttlSeconds = 600): Promise<void> {
  await redis.setex(`otp:${email}`, ttlSeconds, hashedCode);
}

export async function getOtp(email: string): Promise<string | null> {
  return redis.get(`otp:${email}`);
}

export async function deleteOtp(email: string): Promise<void> {
  await redis.del(`otp:${email}`);
}

// Refresh Token helpers
export async function setRefreshToken(tokenHash: string, userId: string, ttlSeconds: number): Promise<void> {
  await redis.setex(`refresh:${tokenHash}`, ttlSeconds, userId);
}

export async function getRefreshToken(tokenHash: string): Promise<string | null> {
  return redis.get(`refresh:${tokenHash}`);
}

export async function deleteRefreshToken(tokenHash: string): Promise<void> {
  await redis.del(`refresh:${tokenHash}`);
}
