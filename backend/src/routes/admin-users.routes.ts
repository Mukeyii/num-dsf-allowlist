/**
 * admin-users.routes.ts – Whitelist + admin-grant management API.
 * Mounted at /api/v1/admin/users. All write endpoints require a live TOTP code.
 * Dependencies: auth.middleware, admin.middleware, totp.service, admin-users.service
 */
import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireImiAdmin } from '../middleware/admin.middleware';
import { requireFreshTotp } from '../middleware/totp.middleware';
import { stepUpTotpRateLimit } from '../middleware/rateLimit.middleware';
import * as svc from '../services/admin-users.service';
import { AdminUsersError } from '../services/admin-users.service';

export const adminUsersRouter = Router();

adminUsersRouter.use(requireAuth, requireImiAdmin);

// Step-up rate limiter for the TOTP-gated writes (skipped under jest).
const stepUp = process.env.NODE_ENV === 'test' ? [] : [stepUpTotpRateLimit];

function handleError(err: unknown, res: Response): Response {
  if (err instanceof AdminUsersError) {
    const status =
      err.code === 'NOT_FOUND'
        ? 404
        : err.code === 'ALREADY_EXISTS'
          ? 409
          : err.code === 'MIN_ADMINS_REACHED'
            ? 409
            : 400;
    return res.status(status).json({ error: { code: err.code, message: err.message } });
  }
  return res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: (err as Error)?.message } });
}

// GET /api/v1/admin/users
adminUsersRouter.get('/', async (_req, res) => {
  try {
    const data = await svc.listWhitelist();
    res.json({ data });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/v1/admin/users  { email, totpCode }
adminUsersRouter.post('/', ...stepUp, requireFreshTotp, async (req, res) => {
  try {
    await svc.addToWhitelist(req.body?.email, req.user!.email, req.ip);
    res.status(201).json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/v1/admin/users/:email/lock  { reason, totpCode }
adminUsersRouter.post('/:email/lock', ...stepUp, requireFreshTotp, async (req, res) => {
  try {
    await svc.lockWhitelistEntry(req.params.email, req.user!.email, req.body?.reason || '', req.ip);
    res.json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/v1/admin/users/:email/unlock  { totpCode }
adminUsersRouter.post('/:email/unlock', ...stepUp, requireFreshTotp, async (req, res) => {
  try {
    await svc.unlockWhitelistEntry(req.params.email, req.user!.email, req.ip);
    res.json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/v1/admin/users/:email/demote  { totpCode }
adminUsersRouter.post('/:email/demote', ...stepUp, requireFreshTotp, async (req, res) => {
  try {
    await svc.demoteAdmin(req.params.email, req.user!.email, req.ip);
    res.json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});

// DELETE /api/v1/admin/users/:email  { totpCode }
adminUsersRouter.delete('/:email', ...stepUp, requireFreshTotp, async (req, res) => {
  try {
    await svc.removeFromWhitelist(req.params.email, req.user!.email, req.ip);
    res.json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});
