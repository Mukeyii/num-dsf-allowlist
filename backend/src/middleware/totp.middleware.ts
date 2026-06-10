/**
 * totp.middleware.ts – requireFreshTotp step-up guard.
 *
 * Every sensitive admin write must present a fresh 6-digit TOTP code in the
 * request body. This centralizes what were byte-identical `checkTotp` copies
 * across the admin routers, so the 400/401 contract — and any future hardening
 * (backup codes, per-user attempt caps) — lives in one place instead of
 * drifting between routers.
 *
 * Use AFTER requireAuth (relies on req.user) and behind the step-up rate
 * limiter so a stolen access token cannot grind the 6-digit code space.
 *
 * Dependencies: express, totp.service
 */
import { Request, Response, NextFunction } from 'express';
import { verifyTotpCode } from '../services/totp.service';

export async function requireFreshTotp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const code = req.body?.totpCode;
  if (!code || typeof code !== 'string' || code.length !== 6) {
    res
      .status(400)
      .json({ error: { code: 'TOTP_REQUIRED', message: '6-digit TOTP code required' } });
    return;
  }
  const ok = await verifyTotpCode(req.user!.id, code);
  if (!ok) {
    res.status(401).json({ error: { code: 'TOTP_INVALID', message: 'Invalid TOTP code' } });
    return;
  }
  next();
}
