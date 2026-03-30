/**
 * admin-approval.routes.ts – Admin-only approval management endpoints
 * Mounted at /api/v1/admin/approval
 * Dependencies: approval.service, totp.service, auth.middleware, admin.middleware, rateLimit.middleware
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireImiAdmin } from '../middleware/admin.middleware';
import * as svc from '../services/approval.service';
import { verifyTotpCode } from '../services/totp.service';
import { db } from '../db/connection';
import { otpRateLimit } from '../middleware/rateLimit.middleware';
import { sanitizeError } from '../lib/sanitizeError';

export const adminApprovalRouter = Router();

const totpLimiter = process.env.NODE_ENV === 'test' ? [] : [otpRateLimit];

adminApprovalRouter.get('/pending', requireAuth, requireImiAdmin, async (req, res) => {
  res.json({ data: await svc.getPendingApprovals() });
});

adminApprovalRouter.post('/:rid/approve', requireAuth, requireImiAdmin, ...totpLimiter, async (req, res) => {
  try {
    const { totpCode } = req.body;
    if (!totpCode) {
      res.status(400).json({ error: { code: 'TOTP_REQUIRED', message: 'Authenticator code is required.' } });
      return;
    }
    const user = await db('users').where({ email: req.user!.email }).first();
    if (!user || !user.totp_enabled) {
      res.status(403).json({ error: { code: 'TOTP_NOT_CONFIGURED', message: 'TOTP is not configured.' } });
      return;
    }
    const valid = await verifyTotpCode(user.id, totpCode);
    if (!valid) {
      res.status(401).json({ error: { code: 'TOTP_INVALID', message: 'Invalid authenticator code.' } });
      return;
    }
    const result = await svc.approveRequest(req.params.rid, req.user!.email, req.ip || 'unknown');
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

adminApprovalRouter.post('/:rid/reject', requireAuth, requireImiAdmin, ...totpLimiter, async (req, res) => {
  try {
    const { totpCode, comment } = req.body;
    if (!totpCode) {
      res.status(400).json({ error: { code: 'TOTP_REQUIRED', message: 'Authenticator code is required.' } });
      return;
    }
    const user = await db('users').where({ email: req.user!.email }).first();
    if (!user || !user.totp_enabled) {
      res.status(403).json({ error: { code: 'TOTP_NOT_CONFIGURED', message: 'TOTP is not configured.' } });
      return;
    }
    const valid = await verifyTotpCode(user.id, totpCode);
    if (!valid) {
      res.status(401).json({ error: { code: 'TOTP_INVALID', message: 'Invalid authenticator code.' } });
      return;
    }
    const result = await svc.rejectRequest(req.params.rid, req.user!.email, comment || '', req.ip || 'unknown');
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});
