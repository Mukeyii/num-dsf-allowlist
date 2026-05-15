/**
 * admin-marketplace.routes.ts – Admin write endpoints (TOTP-gated).
 * Mounted at /api/v1/admin/marketplace. All write endpoints require a live TOTP code.
 * Dependencies: auth.middleware, admin.middleware, totp.service, marketplace.service
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireImiAdmin } from '../middleware/admin.middleware';
import { validate } from '../middleware/validate.middleware';
import { verifyTotpCode } from '../services/totp.service';
import {
  createMarketplaceSchema,
  patchMarketplaceSchema,
  deleteMarketplaceSchema,
} from '../schemas/marketplace.schema';
import { addEntry, updateStatus, removeEntry } from '../services/marketplace.service';
import { sanitizeError } from '../lib/sanitizeError';

export const adminMarketplaceRouter = Router();
adminMarketplaceRouter.use(requireAuth, requireImiAdmin);

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

// POST /api/v1/admin/marketplace  { gitUrl, status?, totpCode }
adminMarketplaceRouter.post('/', validate(createMarketplaceSchema), async (req, res) => {
  if (!(await checkTotp(req, res))) return;
  try {
    const entry = await addEntry(
      { gitUrl: req.body.gitUrl, status: req.body.status },
      req.user!.email,
      req.ip || 'unknown',
    );
    res.status(201).json({ data: entry });
  } catch (err: unknown) {
    const status = err instanceof Error && err.message === 'ALREADY_EXISTS' ? 409 : 400;
    res.status(status).json({ error: sanitizeError(err) });
  }
});

// PATCH /api/v1/admin/marketplace/:id  { status, totpCode }
adminMarketplaceRouter.patch('/:id', validate(patchMarketplaceSchema), async (req, res) => {
  if (!(await checkTotp(req, res))) return;
  try {
    const entry = await updateStatus(
      req.params.id,
      req.body.status,
      req.user!.email,
      req.ip || 'unknown',
    );
    res.json({ data: entry });
  } catch (err: unknown) {
    const status = err instanceof Error && err.message === 'NOT_FOUND' ? 404 : 400;
    res.status(status).json({ error: sanitizeError(err) });
  }
});

// DELETE /api/v1/admin/marketplace/:id  { totpCode }
adminMarketplaceRouter.delete('/:id', validate(deleteMarketplaceSchema), async (req, res) => {
  if (!(await checkTotp(req, res))) return;
  try {
    await removeEntry(req.params.id, req.user!.email, req.ip || 'unknown');
    res.json({ data: { deleted: true } });
  } catch (err: unknown) {
    const status = err instanceof Error && err.message === 'NOT_FOUND' ? 404 : 400;
    res.status(status).json({ error: sanitizeError(err) });
  }
});
