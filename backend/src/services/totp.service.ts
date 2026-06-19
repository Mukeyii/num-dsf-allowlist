/**
 * totp.service.ts – TOTP setup, verification and backup codes
 * Dependencies: speakeasy, qrcode, bcrypt, crypto, db/connection
 *
 * Security:
 * - TOTP secret encrypted with AES-256-GCM in DB
 * - Backup codes bcrypt-hashed (single-use)
 * - Window: 1 step (30s tolerance up and down)
 */
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../db/connection';
import { redis } from './redis.service';
import { logger } from '../lib/logger';
import { isDevEnv } from '../lib/isDevEnv';

const ENCRYPTION_KEY = Buffer.from(process.env.TOTP_ENCRYPTION_KEY || '', 'hex');
const BCRYPT_ROUNDS = 12;

// AES-256-GCM encryption for TOTP secrets
function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSecret(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

export async function generateTotpSetup(
  email: string,
): Promise<{ qrCodeUrl: string; secret: string }> {
  const secret = speakeasy.generateSecret({
    name: `DSF Allow List (${email})`,
    issuer: 'IMI-Uni-Muenster',
    length: 32,
  });

  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
  return { qrCodeUrl, secret: secret.base32 };
}

export async function saveTotpSecret(userId: string, plainSecret: string): Promise<void> {
  const encrypted = encryptSecret(plainSecret);
  await db('users').where({ id: userId }).update({ totp_secret: encrypted });
}

export async function verifyTotpCode(userId: string, code: string): Promise<boolean> {
  // Dev shortcut: bypass TOTP entirely. Only honored when DEV_AUTO_LOGIN=true,
  // DEV_TOTP_BYPASS=true, and NODE_ENV is on the development/test allowlist
  // (isDevEnv) — an unrecognized NODE_ENV like 'staging' must NOT activate it,
  // matching the same allowlist the dev-login route enforces.
  if (
    isDevEnv() &&
    process.env.DEV_AUTO_LOGIN === 'true' &&
    process.env.DEV_TOTP_BYPASS === 'true'
  ) {
    return true;
  }

  const user = await db('users').where({ id: userId }).first();
  if (!user?.totp_secret) return false;

  const secret = decryptSecret(user.totp_secret);
  // Normalize once: speakeasy verifies the whitespace-stripped token, so the
  // anti-replay claim below MUST hash the same normalized value. Hashing the
  // raw input instead would let a captured code replay under different
  // spacing ('123456' vs '123 456') — each variant claims a different key.
  const normalized = code.replace(/\s/g, '');
  const valid = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: normalized,
    window: 1,
  });

  if (!valid) return false;

  // Anti-replay: atomically claim the code hash; returns null if already claimed.
  // TTL must be ≥ the validity window speakeasy accepts. With window: 1 (a code
  // is valid for the current 30s step plus ±1 step), the worst-case acceptance
  // window is 90 s. A 60 s TTL would let an attacker re-submit a captured code
  // in the last 30 s of its lifetime. 120 s gives a 30 s safety margin.
  const codeHash = crypto.createHash('sha256').update(`${userId}:${normalized}`).digest('hex');
  const replayKey = `totp_used:${codeHash}`;
  const claimed = await redis.set(replayKey, '1', 'EX', 120, 'NX');
  if (claimed === null) return false;

  return true;
}

export async function enableTotp(userId: string): Promise<void> {
  await db('users').where({ id: userId }).update({ totp_enabled: true });
}

// Generate 10 backup codes
export async function generateBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase(),
  );
  const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)));
  await db('users')
    .where({ id: userId })
    .update({ backup_codes: JSON.stringify(hashed) });
  return codes; // returned in plaintext once – never accessible again
}

export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  // The bcrypt comparisons (up to 10 × ~250 ms) run on an UNLOCKED read so they
  // never hold a SELECT ... FOR UPDATE row lock for seconds. Only the atomic
  // single-use claim runs under the lock, and it does string ops only.
  const user = await db('users').where({ id: userId }).first();
  if (!user?.backup_codes) return false;

  let hashed: string[];
  try {
    // MySQL JSON columns return parsed objects; plain strings need parsing
    hashed =
      typeof user.backup_codes === 'string' ? JSON.parse(user.backup_codes) : user.backup_codes;
  } catch {
    logger.error({ userId }, 'Corrupt backup_codes JSON in database');
    return false;
  }
  if (!Array.isArray(hashed)) {
    logger.error({ userId }, 'Corrupt backup_codes JSON in database');
    return false;
  }

  const candidate = code.trim().toUpperCase();
  let matchedHash: string | null = null;
  for (const h of hashed) {
    if (await bcrypt.compare(candidate, h)) {
      matchedHash = h;
      break;
    }
  }
  if (!matchedHash) return false;

  // Atomic single-use claim under the row lock — string ops only, no bcrypt.
  // The matched hash can be spliced exactly once; a concurrent caller that
  // already consumed it finds idx === -1 here and the splice/write never runs,
  // so the same backup code can never authenticate twice.
  return db.transaction(async (trx) => {
    const locked = await trx('users').where({ id: userId }).forUpdate().first();
    let current: string[];
    try {
      current =
        typeof locked.backup_codes === 'string'
          ? JSON.parse(locked.backup_codes)
          : locked.backup_codes;
    } catch {
      return false;
    }
    if (!Array.isArray(current)) return false;
    const idx = current.indexOf(matchedHash);
    if (idx === -1) return false; // already consumed by a concurrent call
    current.splice(idx, 1);
    await trx('users')
      .where({ id: userId })
      .update({ backup_codes: JSON.stringify(current) });
    return true;
  });
}
