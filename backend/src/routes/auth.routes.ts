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
import { REFRESH_TOKEN_TTL_MS } from '../lib/time';
import {
  requestOtp,
  verifyOtpAndGetTempToken,
  verifyTotpAndCreateSession,
  confirmTotpSetupAndCreateSession,
  refreshAccessToken,
  logout,
  verifyTempToken,
  createTokenPair,
} from '../services/auth.service';
import { generateTotpSetup, saveTotpSecret } from '../services/totp.service';
import { writeAuditLog } from '../services/audit.service';
import { extractClientCert } from '../lib/clientCert';
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

export const authRouter = Router();

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: REFRESH_TOKEN_TTL_MS,
  // Scope on /auth (not /auth/refresh) so /auth/logout also receives the
  // cookie and can revoke the Redis entry. Previously logout only cleared
  // the cookie client-side; the server-side refresh token stayed valid
  // for its 7-day TTL.
  path: '/auth',
};

// POST /auth/request-otp
//
// otpLimiter is the Redis-backed 5-req/15-min bucket. Skip it when running
// jest (NODE_ENV=test) and when running a dev/CI environment that enabled
// DEV_AUTO_LOGIN — the e2e suite shares a single CI runner IP and calls
// /dev-login from every test, blowing past 5 in 15 min and silently 429ing.
// Production never sets DEV_AUTO_LOGIN, so the limiter still applies there.
const otpLimiter =
  process.env.NODE_ENV === 'test' ||
  (process.env.NODE_ENV !== 'production' && process.env.DEV_AUTO_LOGIN === 'true')
    ? []
    : [otpRateLimit];
authRouter.post('/request-otp', ...otpLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'Email required' } });
  }
  try {
    await requestOtp(email, req.ip || 'unknown');
    // Always return 200 – no hint whether email is whitelisted
    res.json({ data: { message: 'If this email is registered, a code has been sent.' } });
  } catch {
    res.json({ data: { message: 'If this email is registered, a code has been sent.' } });
  }
});

// POST /auth/verify-otp
authRouter.post('/verify-otp', ...otpLimiter, async (req: Request, res: Response) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'Email and code required' } });
  }
  try {
    const result = await verifyOtpAndGetTempToken(email, code, req.ip || 'unknown');
    res.json({ data: result });
  } catch (err: unknown) {
    res.status(401).json({ error: { code: 'AUTH_FAILED', message: 'Invalid code' } });
  }
});

// POST /auth/setup-totp  → return QR code (first login)
//
// Idempotent for legitimate flows (user double-tabs the QR step), but refuses
// once TOTP is already enabled on the account. Without this gate, a holder
// of a valid totp_setup tempToken (10-min TTL) could call /setup-totp
// repeatedly to rotate the TOTP secret out from under the user.
authRouter.post('/setup-totp', ...otpLimiter, async (req: Request, res: Response) => {
  const { tempToken } = req.body;
  if (!tempToken) {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'tempToken required' } });
  }
  try {
    const payload = verifyTempToken(tempToken);
    if (payload.purpose !== 'totp_setup') throw new Error('Wrong purpose');

    const user = await db('users').where({ id: payload.sub }).first();
    if (user?.totp_enabled) {
      return res.status(409).json({
        error: { code: 'TOTP_ALREADY_ENABLED', message: 'TOTP is already configured for this account' },
      });
    }

    const { qrCodeUrl, secret } = await generateTotpSetup(payload.email);
    await saveTotpSecret(payload.sub, secret);

    res.json({ data: { qrCodeUrl } }); // Secret NOT in response – only QR code
  } catch {
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
  }
});

// POST /auth/confirm-totp  → confirm TOTP after setup + create session
authRouter.post('/confirm-totp', ...otpLimiter, async (req: Request, res: Response) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'tempToken and code required' } });
  }
  try {
    const { accessToken, refreshToken, backupCodes } = await confirmTotpSetupAndCreateSession(
      tempToken, code, req.ip || 'unknown'
    );
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ data: { accessToken, backupCodes } }); // Backup codes returned once
  } catch {
    res.status(401).json({ error: { code: 'AUTH_FAILED', message: 'Invalid TOTP code' } });
  }
});

// POST /auth/verify-totp  → TOTP for subsequent logins
authRouter.post('/verify-totp', ...otpLimiter, async (req: Request, res: Response) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'tempToken and code required' } });
  }
  try {
    const { accessToken, refreshToken } = await verifyTotpAndCreateSession(
      tempToken, code, req.ip || 'unknown'
    );
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ data: { accessToken } });
  } catch {
    res.status(401).json({ error: { code: 'AUTH_FAILED', message: 'Invalid TOTP code' } });
  }
});

// POST /auth/refresh  → new access token
authRouter.post('/refresh', ...otpLimiter, async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No refresh token' } });
  }
  try {
    const { accessToken, refreshToken: newRefreshToken } = await refreshAccessToken(refreshToken);
    res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS);
    res.json({ data: { accessToken } });
  } catch {
    res.clearCookie('refreshToken', { path: '/auth' });
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } });
  }
});

// POST /auth/dev-login → dev-only shortcut that bypasses OTP/TOTP.
// Route is only REGISTERED when NODE_ENV !== 'production' AND DEV_AUTO_LOGIN
// === 'true'. In any prod-like image, no handler is mounted and the path
// returns Express's default 404 — zero attack surface even if a future flag
// were toggled at runtime.
// Body: { role?: 'admin' | 'member' | 'site' }
if (process.env.NODE_ENV !== 'production' && process.env.DEV_AUTO_LOGIN === 'true') {
authRouter.post('/dev-login', ...otpLimiter, async (req: Request, res: Response) => {
  const inputRole = req.body?.role;
  const role: 'admin' | 'member' | 'site' =
    inputRole === 'member' ? 'member' :
    inputRole === 'site'   ? 'site'   : 'admin';
  const envKey =
    role === 'member' ? 'DEV_AUTO_LOGIN_MEMBER_EMAIL' :
    role === 'site'   ? 'DEV_AUTO_LOGIN_SITE_EMAIL'   : 'DEV_AUTO_LOGIN_EMAIL';
  const fallback =
    role === 'member' ? 'member@imi-test.example.de' :
    role === 'site'   ? 'site@imi-test.example.de'   : 'admin@imi-test.example.de';
  const email = (process.env[envKey] || fallback).toLowerCase().trim();
  if (!email) {
    return res.status(400).json({ error: { code: 'CONFIG', message: `${envKey} not configured` } });
  }

  // Ensure whitelisted + user row exists. Idempotent so concurrent calls
  // (e.g. React Strict Mode double-invokes useEffect in dev) don't crash on
  // duplicate-key. Both tables have UNIQUE(email).
  await db('email_whitelist')
    .insert({ id: uuidv4(), email, created_by: 'dev-auto-login', created_at: new Date() })
    .onConflict('email').ignore();
  await db('users')
    .insert({ id: uuidv4(), email, totp_enabled: true, created_at: new Date() })
    .onConflict('email').ignore();
  const user = await db('users').where({ email }).first();
  if (!user) {
    return res.status(500).json({ error: { code: 'USER_NOT_FOUND', message: 'Failed to create or find dev user' } });
  }
  await db('users').where({ id: user.id }).update({ last_login: new Date() });

  const { accessToken, refreshToken } = await createTokenPair({ id: user.id, email: user.email, totpEnabled: true });
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
  console.warn(`[DEV_AUTO_LOGIN] issued ${role} session for ${email} from ${req.ip}`);
  res.json({ data: { accessToken, email, role } });
});
}

// POST /auth/client-cert-login → authenticate by client certificate thumbprint
authRouter.post('/client-cert-login', ...otpLimiter, async (req: Request, res: Response) => {
  const cert = extractClientCert(req);
  if (!cert) {
    res.status(401).json({ error: { code: 'NO_CLIENT_CERT', message: 'No client certificate presented.' } });
    return;
  }
  const org = await db('organizations').where({ client_cert_thumbprint: cert.thumbprint }).first();
  if (!org) {
    res.status(401).json({ error: { code: 'CERT_NOT_REGISTERED', message: 'Certificate is not registered for any organization.' } });
    return;
  }
  const instance = await db('instances').where({ id: org.instance_id }).first();
  if (!instance) {
    res.status(401).json({ error: { code: 'NO_INSTANCE', message: 'Organization has no associated instance.' } });
    return;
  }
  const user = await db('users').where({ id: instance.user_id }).first();
  if (!user) {
    res.status(401).json({ error: { code: 'NO_USER', message: 'Instance has no owner.' } });
    return;
  }

  const wl = await db('email_whitelist').where({ email: user.email }).first();
  if (!wl || wl.locked_at) {
    res.status(401).json({ error: { code: 'ACCOUNT_LOCKED', message: 'Account is locked.' } });
    return;
  }

  const { accessToken, refreshToken } = await createTokenPair({ id: user.id, email: user.email, totpEnabled: true });
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

  writeAuditLog({
    userEmail: user.email,
    instanceId: instance.id,
    resourceType: 'AUTH',
    operation: 'LOGIN',
    ipAddress: req.ip || 'unknown',
  }).catch(() => {});

  res.json({ data: { accessToken, email: user.email } });
});

// POST /auth/logout
authRouter.post('/logout', ...otpLimiter, async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  const userEmail = req.body?.email || 'unknown';
  if (refreshToken) {
    await logout(refreshToken, userEmail, req.ip || 'unknown');
  }
  res.clearCookie('refreshToken', { path: '/auth' });
  res.json({ data: { message: 'Logged out' } });
});
