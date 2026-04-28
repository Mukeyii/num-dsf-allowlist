/**
 * admin-users.routes.ts – Whitelist + admin-grant management API.
 * Mounted at /api/v1/admin/users. All write endpoints require a live TOTP code.
 * Dependencies: auth.middleware, admin.middleware, totp.service, admin-users.service
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireImiAdmin } from '../middleware/admin.middleware';
import { verifyTotpCode } from '../services/totp.service';
import * as svc from '../services/admin-users.service';
import { AdminUsersError } from '../services/admin-users.service';

export const adminUsersRouter = Router();

adminUsersRouter.use(requireAuth, requireImiAdmin);

function handleError(err: unknown, res: Response): Response {
  if (err instanceof AdminUsersError) {
    const status =
      err.code === 'NOT_FOUND' ? 404
      : err.code === 'ALREADY_EXISTS' ? 409
      : err.code === 'MIN_ADMINS_REACHED' ? 409
      : 400;
    return res.status(status).json({ error: { code: err.code, message: err.message } });
  }
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (err as Error)?.message } });
}

async function checkTotp(req: Request, res: Response): Promise<boolean> {
  const code = req.body?.totpCode;
  if (!code || typeof code !== 'string' || code.length !== 6) {
    res.status(400).json({ error: { code: 'TOTP_REQUIRED', message: '6-digit TOTP code required' } });
    return false;
  }
  const ok = await verifyTotpCode(req.user!.id, code);
  if (!ok) {
    res.status(401).json({ error: { code: 'TOTP_INVALID', message: 'Invalid TOTP code' } });
    return false;
  }
  return true;
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
adminUsersRouter.post('/', async (req, res) => {
  if (!(await checkTotp(req, res))) return;
  try {
    await svc.addToWhitelist(req.body?.email, req.user!.email, req.ip);
    res.status(201).json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/v1/admin/users/:email/lock  { reason, totpCode }
adminUsersRouter.post('/:email/lock', async (req, res) => {
  if (!(await checkTotp(req, res))) return;
  try {
    await svc.lockWhitelistEntry(req.params.email, req.user!.email, req.body?.reason || '', req.ip);
    res.json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/v1/admin/users/:email/unlock  { totpCode }
adminUsersRouter.post('/:email/unlock', async (req, res) => {
  if (!(await checkTotp(req, res))) return;
  try {
    await svc.unlockWhitelistEntry(req.params.email, req.user!.email, req.ip);
    res.json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/v1/admin/users/:email/demote  { totpCode }
adminUsersRouter.post('/:email/demote', async (req, res) => {
  if (!(await checkTotp(req, res))) return;
  try {
    await svc.demoteAdmin(req.params.email, req.user!.email, req.ip);
    res.json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});

// DELETE /api/v1/admin/users/:email  { totpCode }
adminUsersRouter.delete('/:email', async (req, res) => {
  if (!(await checkTotp(req, res))) return;
  try {
    await svc.removeFromWhitelist(req.params.email, req.user!.email, req.ip);
    res.json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});
