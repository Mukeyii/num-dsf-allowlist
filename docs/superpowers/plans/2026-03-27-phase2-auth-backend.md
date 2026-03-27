# Phase 2 – Auth Backend: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete passwordless authentication system: Email whitelist + OTP + TOTP 2FA + JWT (RS256) sessions with refresh tokens, rate limiting, and audit logging.

**Architecture:** Passwordless auth flow: user enters email → OTP sent via Mailhog → OTP verified → TOTP setup (first login) or TOTP verify (subsequent) → JWT access token + httpOnly refresh token cookie. All auth events written to audit_logs. Rate limiting via Redis-backed express-rate-limit.

**Tech Stack:** Express, jsonwebtoken (RS256), speakeasy (TOTP), qrcode, bcrypt, crypto, nodemailer, ioredis, cookie-parser, express-rate-limit, rate-limit-redis

---

## File Structure

### New files to create:

| File | Responsibility |
|------|---------------|
| `backend/src/types/auth.types.ts` | TypeScript interfaces for auth flow |
| `backend/src/services/otp.service.ts` | OTP generation, SHA-256 hashing, Redis storage |
| `backend/src/services/totp.service.ts` | TOTP setup, AES-256-GCM encryption, backup codes |
| `backend/src/services/mail.service.ts` | Email sending via Nodemailer |
| `backend/src/services/audit.service.ts` | Append-only audit log writes |
| `backend/src/services/auth.service.ts` | Auth flow orchestration, JWT signing/verification |
| `backend/src/middleware/rateLimit.middleware.ts` | Redis-backed rate limiting config |
| `backend/src/middleware/auth.middleware.ts` | JWT verification middleware |
| `backend/src/db/seed-whitelist.ts` | CLI script to seed admin email |

### Files to modify:

| File | Change |
|------|--------|
| `backend/src/routes/auth.routes.ts` | Replace placeholder with full auth routes |
| `backend/src/index.ts` | Add cookie-parser + API rate limiting |
| `backend/package.json` | Add cookie-parser dependency |

---

### Task 1: Auth Types + cookie-parser Dependency

**Files:**
- Create: `backend/src/types/auth.types.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Create `backend/src/types/auth.types.ts`**

```typescript
/**
 * auth.types.ts – TypeScript interfaces for the auth flow
 * Dependencies: none
 */

export interface AuthUser {
  id: string;
  email: string;
  totpEnabled: boolean;
}

export interface JwtPayload {
  sub: string;       // user.id
  email: string;
  iat: number;
  exp: number;
}

// Temporary token after OTP verification (before TOTP)
export interface TempTokenPayload {
  sub: string;
  email: string;
  purpose: 'totp_required' | 'totp_setup';
  iat: number;
  exp: number;
}

export interface OtpRequestBody {
  email: string;
}

export interface OtpVerifyBody {
  email: string;
  code: string;
}

export interface TotpVerifyBody {
  tempToken: string;
  code: string;
}

export interface TotpConfirmBody {
  tempToken: string;
  code: string;
}
```

- [ ] **Step 2: Add cookie-parser to `backend/package.json`**

Add to `dependencies`:
```
"cookie-parser": "^1.4.6"
```

Add to `devDependencies`:
```
"@types/cookie-parser": "^1.4.7"
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/types/auth.types.ts backend/package.json
git commit -m "feat: add auth types and cookie-parser dependency"
```

---

### Task 2: OTP Service

**Files:**
- Create: `backend/src/services/otp.service.ts`

- [ ] **Step 1: Create `backend/src/services/otp.service.ts`**

```typescript
/**
 * otp.service.ts – OTP generation, hashing and Redis storage
 * Dependencies: crypto, redis.service
 *
 * Security:
 * - OTP generated with crypto.randomInt() (cryptographically secure)
 * - Stored as SHA-256 hash in Redis (plaintext never persisted)
 * - TTL 600s (10 minutes), single-use (deleted immediately after consumption)
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/otp.service.ts
git commit -m "feat: add OTP service with SHA-256 hashing and Redis storage"
```

---

### Task 3: TOTP Service

**Files:**
- Create: `backend/src/services/totp.service.ts`

- [ ] **Step 1: Create `backend/src/services/totp.service.ts`**

```typescript
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
    issuer: 'GECKO-HS-Heilbronn',
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
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code.replace(/\s/g, ''),
    window: 1,
  });
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

  const hashed: string[] = JSON.parse(user.backup_codes);
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/totp.service.ts
git commit -m "feat: add TOTP service with AES-256-GCM encryption and backup codes"
```

---

### Task 4: Mail Service

**Files:**
- Create: `backend/src/services/mail.service.ts`

- [ ] **Step 1: Create `backend/src/services/mail.service.ts`**

```typescript
/**
 * mail.service.ts – Email sending via Nodemailer
 * Dependencies: nodemailer, .env (SMTP_*)
 *
 * In dev: Mailhog on port 1025 (no auth required)
 * In prod: SMTP relay (e.g. Sendgrid) via SMTP_USER + SMTP_PASS
 */
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: false,
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
});

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const environment = process.env.DSF_ENVIRONMENT || 'TEST';

  await transporter.sendMail({
    from: process.env.MAIL_FROM || 'noreply@dsf-allowlist.local',
    to,
    subject: `[DSF Allow List – ${environment}] Your login code`,
    text: `Your login code is: ${code}\n\nThis code expires in 10 minutes and can only be used once.\n\nIf you did not request this code, please ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #6c63ff;">DSF Allow List – ${environment}</h2>
        <p>Your login code:</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px;
                    padding: 20px; background: #f0f2f8; border-radius: 8px;
                    text-align: center; font-family: monospace; color: #1a1a2e;">
          ${code}
        </div>
        <p style="color: #9b9fad; font-size: 13px; margin-top: 20px;">
          This code expires in <strong>10 minutes</strong> and can only be used once.<br>
          If you did not request this, please ignore this email.
        </p>
      </div>
    `,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/mail.service.ts
git commit -m "feat: add mail service with OTP email template"
```

---

### Task 5: Audit Service

**Files:**
- Create: `backend/src/services/audit.service.ts`

- [ ] **Step 1: Create `backend/src/services/audit.service.ts`**

```typescript
/**
 * audit.service.ts – Append-only audit log writes
 * Dependencies: db/connection, uuid
 *
 * Important: Logging failures must NEVER block the actual operation.
 * Always wrap in try-catch. Never log PEM, passwords, or OTP codes.
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

type ResourceType = 'ORGANIZATION' | 'CONTACT' | 'ENDPOINT' | 'CERTIFICATE' | 'MEMBERSHIP' | 'AUTH' | 'APPROVAL';
type Operation = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT' | 'OTP_REQUEST' | 'OTP_VERIFY' | 'TOTP_SETUP' | 'TOTP_VERIFY' | 'FAILED_LOGIN';

interface AuditEntry {
  userEmail?: string;
  instanceId?: string;
  resourceType: ResourceType;
  resourceId?: string;
  operation: Operation;
  diffJson?: object;
  ipAddress?: string;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await db('audit_logs').insert({
      id: uuidv4(),
      timestamp: new Date(),
      user_email: entry.userEmail,
      instance_id: entry.instanceId,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      operation: entry.operation,
      diff_json: entry.diffJson ? JSON.stringify(entry.diffJson) : null,
      ip_address: entry.ipAddress,
    });
  } catch (err) {
    // Logging failure must never propagate
    console.error('[AuditLog] Failed to write entry:', err);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/audit.service.ts
git commit -m "feat: add audit service with append-only log writes"
```

---

### Task 6: Auth Service (Flow Orchestrator)

**Files:**
- Create: `backend/src/services/auth.service.ts`

- [ ] **Step 1: Create `backend/src/services/auth.service.ts`**

```typescript
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
    { algorithm: 'RS256', expiresIn: JWT_EXPIRES_IN }
  );
}

function signTempToken(user: AuthUser, purpose: TempTokenPayload['purpose']): string {
  return jwt.sign(
    { sub: user.id, email: user.email, purpose },
    JWT_PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: '10m' }
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
async function createTokenPair(user: AuthUser): Promise<{ accessToken: string; refreshTokenHash: string }> {
  const accessToken = signAccessToken(user);
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  await setRefreshToken(refreshTokenHash, user.id, REFRESH_TTL_SEC);
  return { accessToken, refreshTokenHash: refreshToken }; // plaintext token to frontend
}

// Refresh: issue new access token
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const { getRefreshToken } = await import('./redis.service');
  const userId = await getRefreshToken(hash);
  if (!userId) throw new Error('INVALID_REFRESH_TOKEN');

  const user = await db('users').where({ id: userId }).first();
  if (!user) throw new Error('USER_NOT_FOUND');

  return signAccessToken({ id: user.id, email: user.email, totpEnabled: user.totp_enabled });
}

// Logout: revoke refresh token
export async function logout(refreshToken: string, userEmail: string, ipAddress: string): Promise<void> {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await deleteRefreshToken(hash);
  await writeAuditLog({ userEmail, resourceType: 'AUTH', operation: 'LOGOUT', ipAddress });
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/auth.service.ts
git commit -m "feat: add auth service with JWT RS256 token management and auth flow orchestration"
```

---

### Task 7: Rate Limiting Middleware

**Files:**
- Create: `backend/src/middleware/rateLimit.middleware.ts`

- [ ] **Step 1: Create `backend/src/middleware/rateLimit.middleware.ts`**

```typescript
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
    client: redis,
    prefix: `ratelimit:${prefix}:`,
    sendCommand: (...args: string[]) => (redis as any).call(...args),
  });
}

export const otpRateLimit = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_OTP_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_OTP_MAX || '5'),
  store: createRedisStore('otp'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait 15 minutes.' } },
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/middleware/rateLimit.middleware.ts
git commit -m "feat: add Redis-backed rate limiting middleware"
```

---

### Task 8: Auth Middleware (JWT Verification)

**Files:**
- Create: `backend/src/middleware/auth.middleware.ts`

- [ ] **Step 1: Create `backend/src/middleware/auth.middleware.ts`**

```typescript
/**
 * auth.middleware.ts – JWT verification, request identity injection
 * Dependencies: auth.service (verifyAccessToken)
 */
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/auth.service';

// Extend req.user types
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/middleware/auth.middleware.ts
git commit -m "feat: add JWT auth middleware with Bearer token verification"
```

---

### Task 9: Auth Routes (Replace Placeholder)

**Files:**
- Modify: `backend/src/routes/auth.routes.ts` (full replacement)

- [ ] **Step 1: Replace `backend/src/routes/auth.routes.ts` with full implementation**

```typescript
/**
 * auth.routes.ts – All auth endpoints
 * Dependencies: auth.service, totp.service, rateLimit.middleware
 *
 * Endpoints:
 *   POST /auth/request-otp
 *   POST /auth/verify-otp
 *   POST /auth/setup-totp
 *   POST /auth/verify-totp
 *   POST /auth/confirm-totp
 *   POST /auth/refresh
 *   POST /auth/logout
 */
import { Router, Request, Response } from 'express';
import { otpRateLimit } from '../middleware/rateLimit.middleware';
import {
  requestOtp,
  verifyOtpAndGetTempToken,
  verifyTotpAndCreateSession,
  confirmTotpSetupAndCreateSession,
  refreshAccessToken,
  logout,
  verifyTempToken,
} from '../services/auth.service';
import { generateTotpSetup, saveTotpSecret } from '../services/totp.service';

export const authRouter = Router();

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/auth/refresh',
};

function getIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
}

// POST /auth/request-otp
authRouter.post('/request-otp', otpRateLimit, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'Email required' } });
  }
  try {
    await requestOtp(email, getIp(req));
    // Always return 200 – no hint whether email is whitelisted
    res.json({ data: { message: 'If this email is registered, a code has been sent.' } });
  } catch {
    res.json({ data: { message: 'If this email is registered, a code has been sent.' } });
  }
});

// POST /auth/verify-otp
authRouter.post('/verify-otp', otpRateLimit, async (req: Request, res: Response) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'Email and code required' } });
  }
  try {
    const result = await verifyOtpAndGetTempToken(email, code, getIp(req));
    res.json({ data: result });
  } catch (err: any) {
    res.status(401).json({ error: { code: 'AUTH_FAILED', message: 'Invalid code' } });
  }
});

// POST /auth/setup-totp  → return QR code (first login)
authRouter.post('/setup-totp', async (req: Request, res: Response) => {
  const { tempToken } = req.body;
  if (!tempToken) {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'tempToken required' } });
  }
  try {
    const payload = verifyTempToken(tempToken);
    if (payload.purpose !== 'totp_setup') throw new Error('Wrong purpose');

    const { qrCodeUrl, secret } = await generateTotpSetup(payload.email);
    await saveTotpSecret(payload.sub, secret);

    res.json({ data: { qrCodeUrl } }); // Secret NOT in response – only QR code
  } catch {
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
  }
});

// POST /auth/confirm-totp  → confirm TOTP after setup + create session
authRouter.post('/confirm-totp', otpRateLimit, async (req: Request, res: Response) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'tempToken and code required' } });
  }
  try {
    const { accessToken, refreshTokenHash, backupCodes } = await confirmTotpSetupAndCreateSession(
      tempToken, code, getIp(req)
    );
    res.cookie('refreshToken', refreshTokenHash, REFRESH_COOKIE_OPTIONS);
    res.json({ data: { accessToken, backupCodes } }); // Backup codes returned once
  } catch {
    res.status(401).json({ error: { code: 'AUTH_FAILED', message: 'Invalid TOTP code' } });
  }
});

// POST /auth/verify-totp  → TOTP for subsequent logins
authRouter.post('/verify-totp', otpRateLimit, async (req: Request, res: Response) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'tempToken and code required' } });
  }
  try {
    const { accessToken, refreshTokenHash } = await verifyTotpAndCreateSession(
      tempToken, code, getIp(req)
    );
    res.cookie('refreshToken', refreshTokenHash, REFRESH_COOKIE_OPTIONS);
    res.json({ data: { accessToken } });
  } catch {
    res.status(401).json({ error: { code: 'AUTH_FAILED', message: 'Invalid TOTP code' } });
  }
});

// POST /auth/refresh  → new access token
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No refresh token' } });
  }
  try {
    const accessToken = await refreshAccessToken(refreshToken);
    res.json({ data: { accessToken } });
  } catch {
    res.clearCookie('refreshToken', { path: '/auth/refresh' });
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } });
  }
});

// POST /auth/logout
authRouter.post('/logout', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  const userEmail = req.body?.email || 'unknown';
  if (refreshToken) {
    await logout(refreshToken, userEmail, getIp(req));
  }
  res.clearCookie('refreshToken', { path: '/auth/refresh' });
  res.json({ data: { message: 'Logged out' } });
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/auth.routes.ts
git commit -m "feat: replace auth route placeholders with full OTP/TOTP/JWT auth endpoints"
```

---

### Task 10: Update index.ts (cookie-parser + API rate limiting)

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Update `backend/src/index.ts`**

Add these two imports after the existing imports:

```typescript
import cookieParser from 'cookie-parser';
import { apiRateLimit } from './middleware/rateLimit.middleware';
```

Add `app.use(cookieParser());` after the `app.use(express.urlencoded({ extended: true }));` line.

Add `app.use('/api', apiRateLimit);` before the routes section (before `app.use('/auth', authRouter);`).

The full updated file:

```typescript
/**
 * index.ts – Express App Bootstrap
 * Starts the server, registers middleware and all routes
 * Depends on: dotenv, express, helmet, cors, cookie-parser, db/connection, services/redis.service
 */
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes';
import { instancesRouter } from './routes/instances.routes';
import { testDbConnection } from './db/connection';
import { testRedisConnection } from './services/redis.service';
import { apiRateLimit } from './middleware/rateLimit.middleware';

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Trust nginx proxy
app.set('trust proxy', 1);

// Rate limiting on API routes
app.use('/api', apiRateLimit);

// Routes
app.use('/auth', authRouter);
app.use('/api/v1/instances', instancesRouter);

// Health Check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', environment: process.env.DSF_ENVIRONMENT || 'UNKNOWN' });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Startup
async function start() {
  try {
    await testDbConnection();
    console.log('✓ MySQL connected');
    await testRedisConnection();
    console.log('✓ Redis connected');
    app.listen(PORT, () => {
      console.log(`✓ Backend running on port ${PORT} [${process.env.DSF_ENVIRONMENT}]`);
    });
  } catch (err) {
    console.error('✗ Startup failed:', err);
    process.exit(1);
  }
}

start();
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat: add cookie-parser and API rate limiting to Express bootstrap"
```

---

### Task 11: Seed Whitelist Script

**Files:**
- Create: `backend/src/db/seed-whitelist.ts`

- [ ] **Step 1: Create `backend/src/db/seed-whitelist.ts`**

```typescript
/**
 * seed-whitelist.ts – Seed first admin email into the whitelist
 * Usage: npx ts-node src/db/seed-whitelist.ts admin@example.com
 * Dependencies: db/connection, uuid
 */
import 'dotenv/config';
import { db } from './connection';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx ts-node src/db/seed-whitelist.ts <email>');
    process.exit(1);
  }

  const normalized = email.toLowerCase().trim();
  await db('email_whitelist').insert({
    id: uuidv4(),
    email: normalized,
    created_by: 'seed',
    created_at: new Date(),
  }).onConflict('email').ignore();

  console.log(`✓ Whitelisted: ${normalized}`);
  await db.destroy();
}

main().catch(console.error);
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/db/seed-whitelist.ts
git commit -m "feat: add whitelist seed script for initial admin email"
```

---

## Acceptance Criteria (from spec)

- [ ] `POST /auth/request-otp` always responds 200 (even for non-whitelisted emails)
- [ ] OTP email appears in Mailhog with correctly formatted HTML template
- [ ] OTP is single-use – second attempt fails
- [ ] `POST /auth/verify-otp` returns `tempToken` + `requiresTotpSetup`
- [ ] `POST /auth/setup-totp` returns base64 QR code
- [ ] QR code scannable with Google Authenticator / Authy
- [ ] `POST /auth/confirm-totp` with correct code → `accessToken` + cookie + 10 backup codes
- [ ] `POST /auth/verify-totp` (subsequent login) works
- [ ] Refresh token stored in Redis (verify: `redis-cli keys "refresh:*"`)
- [ ] Rate limiting: 6th request to `/auth/request-otp` → 429
- [ ] Audit log: all events in `audit_logs` table (OTP_REQUEST, OTP_VERIFY, TOTP_SETUP, LOGIN)
- [ ] No OTP code, TOTP secret, or PEM visible anywhere in logs
