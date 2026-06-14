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
import { REFRESH_TOKEN_TTL_SEC as REFRESH_TTL_SEC } from '../lib/time';
import { logger } from '../lib/logger';

// JWT keys loaded from Base64 env vars
const JWT_PRIVATE_KEY = Buffer.from(process.env.JWT_PRIVATE_KEY_BASE64 || '', 'base64').toString(
  'utf8',
);
const JWT_PUBLIC_KEY = Buffer.from(process.env.JWT_PUBLIC_KEY_BASE64 || '', 'base64').toString(
  'utf8',
);
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';

// ─── Helper functions ───────────────────────────────────────────────────────

function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email } as Omit<JwtPayload, 'iat' | 'exp'>,
    JWT_PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: JWT_EXPIRES_IN } as any,
  );
}

function signTempToken(user: AuthUser, purpose: TempTokenPayload['purpose']): string {
  return jwt.sign({ sub: user.id, email: user.email, purpose }, JWT_PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: '10m',
  } as any);
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

  // Whitelist check (generic error message on rejection – no hint if email exists or is locked)
  const whitelisted = await db('email_whitelist').where({ email: normalized }).first();
  if (!whitelisted || whitelisted.locked_at) {
    await writeAuditLog({
      userEmail: normalized,
      resourceType: 'AUTH',
      operation: 'FAILED_LOGIN',
      ipAddress,
    });
    throw new Error('NOT_WHITELISTED');
  }

  const code = await createAndStoreOtp(normalized);
  await sendOtpEmail(normalized, code);
  await writeAuditLog({
    userEmail: normalized,
    resourceType: 'AUTH',
    operation: 'OTP_REQUEST',
    ipAddress,
  });
}

// Step 2: Verify OTP → return temporary token
export async function verifyOtpAndGetTempToken(
  email: string,
  code: string,
  ipAddress: string,
): Promise<{ tempToken: string; requiresTotpSetup: boolean }> {
  const normalized = email.toLowerCase().trim();
  const valid = await verifyOtp(normalized, code);

  if (!valid) {
    await writeAuditLog({
      userEmail: normalized,
      resourceType: 'AUTH',
      operation: 'FAILED_LOGIN',
      ipAddress,
    });
    throw new Error('INVALID_OTP');
  }

  // Get or create user in DB
  let user = await db('users').where({ email: normalized }).first();
  if (!user) {
    const id = uuidv4();
    await db('users').insert({ id, email: normalized, created_at: new Date() });
    user = await db('users').where({ id }).first();
  }

  await writeAuditLog({
    userEmail: normalized,
    resourceType: 'AUTH',
    operation: 'OTP_VERIFY',
    ipAddress,
  });

  const requiresTotpSetup = !user.totp_enabled;
  const purpose = requiresTotpSetup ? 'totp_setup' : 'totp_required';
  const tempToken = signTempToken(
    { id: user.id, email: user.email, totpEnabled: user.totp_enabled },
    purpose,
  );

  return { tempToken, requiresTotpSetup };
}

// Step 3a: Verify TOTP code → create full session
export async function verifyTotpAndCreateSession(
  tempToken: string,
  code: string,
  ipAddress: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const payload = verifyTempToken(tempToken);
  if (payload.purpose !== 'totp_required') throw new Error('INVALID_TOKEN_PURPOSE');

  const user = await db('users').where({ id: payload.sub }).first();
  if (!user) throw new Error('USER_NOT_FOUND');

  // Accept TOTP code or backup code
  const totpValid = await verifyTotpCode(user.id, code);
  const backupValid = !totpValid && (await verifyBackupCode(user.id, code));

  if (!totpValid && !backupValid) {
    await writeAuditLog({
      userEmail: user.email,
      resourceType: 'AUTH',
      operation: 'FAILED_LOGIN',
      ipAddress,
    });
    throw new Error('INVALID_TOTP');
  }

  await db('users').where({ id: user.id }).update({ last_login: new Date() });
  await writeAuditLog({
    userEmail: user.email,
    resourceType: 'AUTH',
    operation: 'TOTP_VERIFY',
    ipAddress,
  });
  await writeAuditLog({
    userEmail: user.email,
    resourceType: 'AUTH',
    operation: 'LOGIN',
    ipAddress,
  });

  return createTokenPair({ id: user.id, email: user.email, totpEnabled: true });
}

// Step 3b: Confirm TOTP after setup
export async function confirmTotpSetupAndCreateSession(
  tempToken: string,
  code: string,
  ipAddress: string,
): Promise<{ accessToken: string; refreshToken: string; backupCodes: string[] }> {
  const payload = verifyTempToken(tempToken);
  if (payload.purpose !== 'totp_setup') throw new Error('INVALID_TOKEN_PURPOSE');

  const user = await db('users').where({ id: payload.sub }).first();
  if (!user?.totp_secret) throw new Error('TOTP_NOT_INITIALIZED');

  const valid = await verifyTotpCode(user.id, code);
  if (!valid) throw new Error('INVALID_TOTP_CODE');

  await db('users').where({ id: user.id }).update({ totp_enabled: true, last_login: new Date() });
  await writeAuditLog({
    userEmail: user.email,
    resourceType: 'AUTH',
    operation: 'TOTP_SETUP',
    ipAddress,
  });
  await writeAuditLog({
    userEmail: user.email,
    resourceType: 'AUTH',
    operation: 'LOGIN',
    ipAddress,
  });

  const { generateBackupCodes } = await import('./totp.service');
  const backupCodes = await generateBackupCodes(user.id);
  const tokens = await createTokenPair({ id: user.id, email: user.email, totpEnabled: true });

  return { ...tokens, backupCodes };
}

// Create token pair + store refresh in Redis.
// IMPORTANT: the returned `refreshToken` is the PLAINTEXT token (set on the
// httpOnly cookie). Redis stores the SHA-256 hash so a DB dump of the
// `refresh:*` keyspace does not yield usable tokens.
export async function createTokenPair(
  user: AuthUser,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken(user);
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  await setRefreshToken(refreshTokenHash, user.id, REFRESH_TTL_SEC);
  return { accessToken, refreshToken };
}

// Refresh: rotate refresh token and issue new access token
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const { getRefreshToken } = await import('./redis.service');
  const userId = await getRefreshToken(hash);
  if (!userId) throw new Error('INVALID_REFRESH_TOKEN');

  const user = await db('users').where({ id: userId }).first();
  if (!user) throw new Error('USER_NOT_FOUND');

  // Lock check on every rotation. The access token is stateless (lives ≤
  // JWT_EXPIRES_IN), but without this a locked or de-whitelisted account could
  // keep minting fresh 7-day refresh tokens forever — revokeAllSessions only
  // clears the tokens that existed at lock time. Re-checking here caps a locked
  // account's residual access at one access-token lifetime.
  const whitelisted = await db('email_whitelist').where({ email: user.email }).first();
  if (!whitelisted || whitelisted.locked_at) {
    await deleteRefreshToken(hash);
    throw new Error('ACCOUNT_LOCKED');
  }

  // Idle timeout check: reject refresh if user has been inactive. A missing
  // activity key means the idle window lapsed. But if Redis itself is
  // unreachable, the read throws — and treating that as "idle" would log out
  // every active user during a transient Redis blip. So distinguish the two:
  // on a Redis error we fail soft (allow the refresh) and log it, instead of
  // mass-revoking sessions.
  const { redis: redisClient } = await import('./redis.service');
  let lastActivity: string | null = null;
  let redisReachable = true;
  try {
    lastActivity = await redisClient.get(`activity:${userId}`);
  } catch (err) {
    redisReachable = false;
    logger.warn(
      { err, userId },
      '[auth] Redis unreachable during idle check — allowing refresh (fail-soft)',
    );
  }
  if (redisReachable && !lastActivity && process.env.NODE_ENV !== 'test') {
    // User has been idle too long — revoke all tokens
    await deleteRefreshToken(hash);
    throw new Error('SESSION_EXPIRED');
  }

  // Rotate: delete old token and issue a new pair. createTokenPair is the
  // single mint path (signs + mints + hashes + stores), so rotation and
  // initial issuance can't drift apart.
  await deleteRefreshToken(hash);
  return createTokenPair({ id: user.id, email: user.email, totpEnabled: user.totp_enabled });
}

// Logout: revoke refresh token
export async function logout(
  refreshToken: string,
  userEmail: string,
  ipAddress: string,
): Promise<void> {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await deleteRefreshToken(hash);
  await writeAuditLog({ userEmail, resourceType: 'AUTH', operation: 'LOGOUT', ipAddress });
}

/**
 * Invalidate ALL refresh tokens for a user. Forces re-login on next API call.
 * Called when an admin locks / demotes / removes the user.
 *
 * Storage scheme: keys are `refresh:<tokenHash>`, values are userId strings.
 * There is no per-user index, so we scan `refresh:*` and delete matching keys.
 * Returns the number of tokens revoked (0 if user has no active sessions).
 */
export async function revokeAllSessions(
  emailOrUser: string | { id: string; email?: string },
): Promise<number> {
  const { redis } = await import('./redis.service');

  let userId: string | undefined;
  if (typeof emailOrUser === 'string') {
    const user = await db('users').where({ email: emailOrUser.toLowerCase() }).first();
    if (!user) return 0;
    userId = user.id as string;
  } else {
    userId = emailOrUser.id;
  }
  if (!userId) return 0;

  // Scan the keyspace in cursor-paged batches instead of redis.keys('refresh:*').
  // KEYS is O(N) over the entire keyspace and blocks Redis while it runs — at
  // 10K+ active sessions that stalls every other command (auth, rate-limit,
  // OTP). SCAN streams matching keys in chunks of `count`, never blocking
  // for more than one chunk at a time.
  //
  // Caveat: SCAN can return duplicates across iterations; the user-id check
  // below still deletes the right keys, but `toDelete.length` may double-count
  // duplicates. The dedup via Set guards against that.
  const matched = new Set<string>();
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', 'refresh:*', 'COUNT', 500);
    cursor = next;
    for (const key of batch) matched.add(key);
  } while (cursor !== '0');

  if (matched.size === 0) return 0;

  // Check each token's stored userId — only delete tokens belonging to this user.
  const pipeline = redis.pipeline();
  const keyList = [...matched];
  for (const key of keyList) {
    pipeline.get(key);
  }
  const values = await pipeline.exec();
  if (!values) return 0;

  const toDelete: string[] = [];
  for (let i = 0; i < keyList.length; i++) {
    const val = values[i]?.[1];
    if (val === userId) {
      toDelete.push(keyList[i]);
    }
  }
  if (toDelete.length === 0) return 0;

  await redis.del(...toDelete);
  return toDelete.length;
}
