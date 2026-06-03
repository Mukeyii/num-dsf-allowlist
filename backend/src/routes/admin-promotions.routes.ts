/**
 * admin-promotions.routes.ts – 4-eyes admin promotion workflow.
 * Mounted at /api/v1/admin/promotions.
 * Dependencies: auth.middleware, admin.middleware, totp.service, admin-promotions.service
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireImiAdmin } from '../middleware/admin.middleware';
import { verifyTotpCode } from '../services/totp.service';
import * as svc from '../services/admin-promotions.service';
import { PromotionError } from '../services/admin-promotions.service';

export const adminPromotionsRouter = Router();
adminPromotionsRouter.use(requireAuth, requireImiAdmin);

function handleError(err: unknown, res: Response): Response {
  if (err instanceof PromotionError) {
    const status =
      err.code === 'NOT_FOUND'
        ? 404
        : err.code === 'ALREADY_PENDING'
          ? 409
          : err.code === 'ALREADY_ADMIN'
            ? 409
            : err.code === 'NOT_PENDING'
              ? 409
              : err.code === 'SAME_SITE'
                ? 403
                : err.code === 'SELF_APPROVE'
                  ? 403
                  : 400;
    return res.status(status).json({ error: { code: err.code, message: err.message } });
  }
  return res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: (err as Error)?.message } });
}

async function checkTotp(req: Request, res: Response): Promise<boolean> {
  const code = req.body?.totpCode;
  if (!code || typeof code !== 'string' || code.length !== 6) {
    res
      .status(400)
      .json({ error: { code: 'TOTP_REQUIRED', message: '6-digit TOTP code required' } });
    return false;
  }
  const ok = await verifyTotpCode(req.user!.id, code);
  if (!ok) {
    res.status(401).json({ error: { code: 'TOTP_INVALID', message: 'Invalid TOTP code' } });
    return false;
  }
  return true;
}

// GET /api/v1/admin/promotions
adminPromotionsRouter.get('/', async (_req, res) => {
  try {
    const data = await svc.listPendingPromotions();
    res.json({ data });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/v1/admin/promotions  { targetEmail, totpCode }
adminPromotionsRouter.post('/', async (req, res) => {
  if (!(await checkTotp(req, res))) return;
  try {
    const result = await svc.createPromotionRequest(req.body?.targetEmail, req.user!.email, req.ip);
    res.status(201).json({ data: result });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/v1/admin/promotions/:id/approve  { totpCode }
adminPromotionsRouter.post('/:id/approve', async (req, res) => {
  if (!(await checkTotp(req, res))) return;
  try {
    await svc.approvePromotion(req.params.id, req.user!.email, req.ip);
    res.json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/v1/admin/promotions/:id/reject  { reason, totpCode }
adminPromotionsRouter.post('/:id/reject', async (req, res) => {
  if (!(await checkTotp(req, res))) return;
  try {
    await svc.rejectPromotion(req.params.id, req.user!.email, req.body?.reason || '', req.ip);
    res.json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/v1/admin/promotions/:id/cancel  { totpCode }
adminPromotionsRouter.post('/:id/cancel', async (req, res) => {
  if (!(await checkTotp(req, res))) return;
  try {
    await svc.cancelPromotion(req.params.id, req.user!.email, req.ip);
    res.json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});
