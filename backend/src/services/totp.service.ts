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

export async function generateTotpSetup(email: string): Promise<{ qrCodeUrl: string; secret: string }> {
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
  const user = await db('users').where({ id: userId }).first();
  if (!user?.totp_secret) return false;

  const secret = decryptSecret(user.totp_secret);
  const valid = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code.replace(/\s/g, ''),
    window: 1,
  });

  if (!valid) return false;

  // Anti-replay: store used code hash in Redis for 60 seconds
  const codeHash = crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');
  const replayKey = `totp_used:${codeHash}`;
  const alreadyUsed = await redis.get(replayKey);
  if (alreadyUsed) return false;
  await redis.setex(replayKey, 60, '1');

  return true;
}

export async function enableTotp(userId: string): Promise<void> {
  await db('users').where({ id: userId }).update({ totp_enabled: true });
}

// Generate 10 backup codes
export async function generateBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );
  const hashed = await Promise.all(codes.map(c => bcrypt.hash(c, BCRYPT_ROUNDS)));
  await db('users').where({ id: userId }).update({ backup_codes: JSON.stringify(hashed) });
  return codes; // returned in plaintext once – never accessible again
}

export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const user = await db('users').where({ id: userId }).first();
  if (!user?.backup_codes) return false;

  let hashed: string[];
  try {
    hashed = JSON.parse(user.backup_codes);
  } catch {
    logger.error({ userId }, 'Corrupt backup_codes JSON in database');
    return false;
  }
  for (let i = 0; i < hashed.length; i++) {
    if (await bcrypt.compare(code.trim().toUpperCase(), hashed[i])) {
      // Remove consumed code
      hashed.splice(i, 1);
      await db('users').where({ id: userId }).update({ backup_codes: JSON.stringify(hashed) });
      return true;
    }
  }
  return false;
}
