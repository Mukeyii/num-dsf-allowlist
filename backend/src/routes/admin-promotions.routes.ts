/**
 * admin-promotions.routes.ts – 4-eyes admin promotion workflow.
 * Mounted at /api/v1/admin/promotions.
 * Dependencies: auth.middleware, admin.middleware, totp.service, admin-promotions.service
 */
import { Router, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireImiAdmin } from '../middleware/admin.middleware';
import { requireFreshTotp } from '../middleware/totp.middleware';
import { stepUpTotpRateLimit } from '../middleware/rateLimit.middleware';
import * as svc from '../services/admin-promotions.service';
import { PromotionError } from '../services/admin-promotions.service';

export const adminPromotionsRouter = Router();
adminPromotionsRouter.use(requireAuth, requireImiAdmin);

// Step-up rate limiter for the TOTP-gated writes (skipped under jest).
const stepUp = process.env.NODE_ENV === 'test' ? [] : [stepUpTotpRateLimit];

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
adminPromotionsRouter.post('/', ...stepUp, requireFreshTotp, async (req, res) => {
  try {
    const result = await svc.createPromotionRequest(req.body?.targetEmail, req.user!.email, req.ip);
    res.status(201).json({ data: result });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/v1/admin/promotions/:id/approve  { totpCode }
adminPromotionsRouter.post('/:id/approve', ...stepUp, requireFreshTotp, async (req, res) => {
  try {
    await svc.approvePromotion(req.params.id, req.user!.email, req.ip);
    res.json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/v1/admin/promotions/:id/reject  { reason, totpCode }
adminPromotionsRouter.post('/:id/reject', ...stepUp, requireFreshTotp, async (req, res) => {
  try {
    await svc.rejectPromotion(req.params.id, req.user!.email, req.body?.reason || '', req.ip);
    res.json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});

// POST /api/v1/admin/promotions/:id/cancel  { totpCode }
adminPromotionsRouter.post('/:id/cancel', ...stepUp, requireFreshTotp, async (req, res) => {
  try {
    await svc.cancelPromotion(req.params.id, req.user!.email, req.ip);
    res.json({ data: { ok: true } });
  } catch (err) {
    handleError(err, res);
  }
});
