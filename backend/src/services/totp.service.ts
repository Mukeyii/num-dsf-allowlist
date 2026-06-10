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
  // DEV_TOTP_BYPASS=true, and NODE_ENV !== 'production' (matches the same
  // localhost-only constraints already enforced by the dev-login route).
  if (
    process.env.NODE_ENV !== 'production' &&
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
  // Atomic claim: the prior implementation was a read → bcrypt.compare → write
  // sequence without a transaction. Two simultaneous calls for the same
  // userId could both pass bcrypt.compare on the same code, both splice
  // their (now-stale) in-memory array, and both write — last-writer-wins
  // could leave the consumed code still present, letting the same backup
  // code authenticate twice. Wrap in a transaction with SELECT ... FOR UPDATE
  // so the second caller blocks until the first commits; by then the
  // consumed code is gone from `backup_codes` and the compare fails.
  return db.transaction(async (trx) => {
    const user = await trx('users').where({ id: userId }).forUpdate().first();
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
    for (let i = 0; i < hashed.length; i++) {
      if (await bcrypt.compare(code.trim().toUpperCase(), hashed[i])) {
        // Remove consumed code under the row lock so concurrent verifies
        // observe the shrunken array.
        hashed.splice(i, 1);
        await trx('users')
          .where({ id: userId })
          .update({ backup_codes: JSON.stringify(hashed) });
        return true;
      }
    }
    return false;
  });
}
