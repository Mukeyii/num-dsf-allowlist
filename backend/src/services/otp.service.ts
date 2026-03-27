/**
 * otp.service.ts – OTP generation, hashing and Redis storage
 * Dependencies: crypto, redis.service
 *
 * Security:
 * - OTP generated with crypto.randomInt() (cryptographically secure)
 * - Stored as SHA-256 hash in Redis (plaintext never persisted)
 * - TTL 600s (10 minutes), single-use (deleted immediately after consumed)
 * - Max 5 attempts per IP via rate-limiting middleware
 */
import crypto from 'crypto';
import { setOtp, getOtp, deleteOtp } from './redis.service';

const OTP_TTL_SECONDS = 600;

function generateOtp(): string {
  // 6-digit code, preserving leading zeros
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export async function createAndStoreOtp(email: string): Promise<string> {
  const code = generateOtp();
  const hashed = hashOtp(code);
  await setOtp(email.toLowerCase(), hashed, OTP_TTL_SECONDS);
  return code; // only briefly in memory – send via mail immediately, then discard
}

export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const stored = await getOtp(email.toLowerCase());
  if (!stored) return false;

  const hashed = hashOtp(code.trim());
  const valid = crypto.timingSafeEqual(
    Buffer.from(stored, 'hex'),
    Buffer.from(hashed, 'hex')
  );

  // Always delete after verification attempt (single-use)
  await deleteOtp(email.toLowerCase());
  return valid;
}
