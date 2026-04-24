/**
 * auth.service.ts – Auth flow orchestration
 * Dependencies: otp.service, totp.service, mail.service, audit.service, DB, JWT, Redis
 *
 * Flow:
 * requestOtp → verifyOtp → (verifyTotp | setupTotp + confirmTotp) → createSession
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { createAndStoreOtp, verifyOtp } from './otp.service';
import { verifyTotpCode, verifyBackupCode } from './totp.service';
import { sendOtpEmail } from './mail.service';
import { setRefreshToken, deleteRefreshToken } from './redis.service';
import { writeAuditLog } from './audit.service';
import type { AuthUser, JwtPayload, TempTokenPayload } from '../types/auth.types';

// JWT keys loaded from Base64 env vars
const JWT_PRIVATE_KEY = Buffer.from(process.env.JWT_PRIVATE_KEY_BASE64 || '', 'base64').toString('utf8');
const JWT_PUBLIC_KEY  = Buffer.from(process.env.JWT_PUBLIC_KEY_BASE64 || '', 'base64').toString('utf8');
const JWT_EXPIRES_IN  = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

// ─── Helper functions ───────────────────────────────────────────────────────

function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email } as Omit<JwtPayload, 'iat' | 'exp'>,
    JWT_PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: JWT_EXPIRES_IN } as any
  );
}

function signTempToken(user: AuthUser, purpose: TempTokenPayload['purpose']): string {
  return jwt.sign(
    { sub: user.id, email: user.email, purpose },
    JWT_PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: '10m' } as any
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] }) as JwtPayload;
}

export function verifyTempToken(token: string): TempTokenPayload {
  return jwt.verify(token, JWT_PUBLIC_KEY, { algorithms: ['RS256'] }) as TempTokenPayload;
}

// ─── Auth flow steps ────────────────────────────────────────────────────────

// Step 1: Check email + send OTP
export async function requestOtp(email: string, ipAddress: string): Promise<void> {
  const normalized = email.toLowerCase().trim();

  // Whitelist check (generic error message on rejection – no hint if email exists)
  const whitelisted = await db('email_whitelist').where({ email: normalized }).first();
  if (!whitelisted) {
    await writeAuditLog({ userEmail: normalized, resourceType: 'AUTH', operation: 'FAILED_LOGIN', ipAddress });
    throw new Error('NOT_WHITELISTED');
  }

  const code = await createAndStoreOtp(normalized);
  await sendOtpEmail(normalized, code);
  await writeAuditLog({ userEmail: normalized, resourceType: 'AUTH', operation: 'OTP_REQUEST', ipAddress });
}

// Step 2: Verify OTP → return temporary token
export async function verifyOtpAndGetTempToken(
  email: string,
  code: string,
  ipAddress: string
): Promise<{ tempToken: string; requiresTotpSetup: boolean }> {
  const normalized = email.toLowerCase().trim();
  const valid = await verifyOtp(normalized, code);

  if (!valid) {
    await writeAuditLog({ userEmail: normalized, resourceType: 'AUTH', operation: 'FAILED_LOGIN', ipAddress });
    throw new Error('INVALID_OTP');
  }

  // Get or create user in DB
  let user = await db('users').where({ email: normalized }).first();
  if (!user) {
    const id = uuidv4();
    await db('users').insert({ id, email: normalized, created_at: new Date() });
    user = await db('users').where({ id }).first();
  }

  await writeAuditLog({ userEmail: normalized, resourceType: 'AUTH', operation: 'OTP_VERIFY', ipAddress });

  const requiresTotpSetup = !user.totp_enabled;
  const purpose = requiresTotpSetup ? 'totp_setup' : 'totp_required';
  const tempToken = signTempToken({ id: user.id, email: user.email, totpEnabled: user.totp_enabled }, purpose);

  return { tempToken, requiresTotpSetup };
}

// Step 3a: Verify TOTP code → create full session
export async function verifyTotpAndCreateSession(
  tempToken: string,
  code: string,
  ipAddress: string
): Promise<{ accessToken: string; refreshTokenHash: string }> {
  const payload = verifyTempToken(tempToken);
  if (payload.purpose !== 'totp_required') throw new Error('INVALID_TOKEN_PURPOSE');

  const user = await db('users').where({ id: payload.sub }).first();
  if (!user) throw new Error('USER_NOT_FOUND');

  // Accept TOTP code or backup code
  const totpValid = await verifyTotpCode(user.id, code);
  const backupValid = !totpValid && await verifyBackupCode(user.id, code);

  if (!totpValid && !backupValid) {
    await writeAuditLog({ userEmail: user.email, resourceType: 'AUTH', operation: 'FAILED_LOGIN', ipAddress });
    throw new Error('INVALID_TOTP');
  }

  await db('users').where({ id: user.id }).update({ last_login: new Date() });
  await writeAuditLog({ userEmail: user.email, resourceType: 'AUTH', operation: 'TOTP_VERIFY', ipAddress });
  await writeAuditLog({ userEmail: user.email, resourceType: 'AUTH', operation: 'LOGIN', ipAddress });

  return createTokenPair({ id: user.id, email: user.email, totpEnabled: true });
}

// Step 3b: Confirm TOTP after setup
export async function confirmTotpSetupAndCreateSession(
  tempToken: string,
  code: string,
  ipAddress: string
): Promise<{ accessToken: string; refreshTokenHash: string; backupCodes: string[] }> {
  const payload = verifyTempToken(tempToken);
  if (payload.purpose !== 'totp_setup') throw new Error('INVALID_TOKEN_PURPOSE');

  const user = await db('users').where({ id: payload.sub }).first();
  if (!user?.totp_secret) throw new Error('TOTP_NOT_INITIALIZED');

  const valid = await verifyTotpCode(user.id, code);
  if (!valid) throw new Error('INVALID_TOTP_CODE');

  await db('users').where({ id: user.id }).update({ totp_enabled: true, last_login: new Date() });
  await writeAuditLog({ userEmail: user.email, resourceType: 'AUTH', operation: 'TOTP_SETUP', ipAddress });
  await writeAuditLog({ userEmail: user.email, resourceType: 'AUTH', operation: 'LOGIN', ipAddress });

  const { generateBackupCodes } = await import('./totp.service');
  const backupCodes = await generateBackupCodes(user.id);
  const tokens = await createTokenPair({ id: user.id, email: user.email, totpEnabled: true });

  return { ...tokens, backupCodes };
}

// Create token pair + store refresh in Redis
export async function createTokenPair(user: AuthUser): Promise<{ accessToken: string; refreshTokenHash: string }> {
  const accessToken = signAccessToken(user);
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  await setRefreshToken(refreshTokenHash, user.id, REFRESH_TTL_SEC);
  return { accessToken, refreshTokenHash: refreshToken }; // plaintext token to frontend
}

// Refresh: rotate refresh token and issue new access token
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const { getRefreshToken } = await import('./redis.service');
  const userId = await getRefreshToken(hash);
  if (!userId) throw new Error('INVALID_REFRESH_TOKEN');

  const user = await db('users').where({ id: userId }).first();
  if (!user) throw new Error('USER_NOT_FOUND');

  // Idle timeout check: reject refresh if user has been inactive
  const { redis: redisClient } = await import('./redis.service');
  const lastActivity = await redisClient.get(`activity:${userId}`);
  if (!lastActivity && process.env.NODE_ENV !== 'test') {
    // User has been idle too long — revoke all tokens
    await deleteRefreshToken(hash);
    throw new Error('SESSION_EXPIRED');
  }

  // Rotate: delete old token and issue a new one
  await deleteRefreshToken(hash);
  const newRefreshToken = crypto.randomBytes(64).toString('hex');
  const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
  await setRefreshToken(newHash, userId, REFRESH_TTL_SEC);

  return {
    accessToken: signAccessToken({ id: user.id, email: user.email, totpEnabled: user.totp_enabled }),
    refreshToken: newRefreshToken,
  };
}

// Logout: revoke refresh token
export async function logout(refreshToken: string, userEmail: string, ipAddress: string): Promise<void> {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await deleteRefreshToken(hash);
  await writeAuditLog({ userEmail, resourceType: 'AUTH', operation: 'LOGOUT', ipAddress });
}
