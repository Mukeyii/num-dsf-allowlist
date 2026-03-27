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
