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

adminApprovalRouter.get('/pending', requireAuth, requireImiAdmin, async (_req, res) => {
  const requests = await svc.getPendingApprovals();
  const enriched = await Promise.all(requests.map(async (r: any) => ({
    ...r,
    signatures: await svc.getSignatures(r.id),
  })));
  res.json({ data: enriched });
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
    const result = await svc.approveRequest(req.params.rid, req.user!.email, req.ip);
    res.json({ data: result });
  } catch (e: any) {
    const code = e?.message;
    if (code === 'ALREADY_DECIDED') return res.status(409).json({ error: { code, message: 'You already decided this request.' } });
    if (code === 'ALREADY_APPROVED_SAME_SITE') return res.status(409).json({ error: { code, message: 'Another admin from your site has already approved.' } });
    if (code === 'REQUEST_REJECTED') return res.status(409).json({ error: { code, message: 'Request was already rejected.' } });
    if (code === 'REQUEST_APPROVED') return res.status(409).json({ error: { code, message: 'Request was already approved.' } });
    if (code === 'REQUEST_FINALIZED') return res.status(409).json({ error: { code, message: 'Request is no longer pending.' } });
    if (code === 'INVALID_ADMIN_EMAIL') return res.status(400).json({ error: { code, message: 'Invalid admin email.' } });
    if (code === 'REQUEST_NOT_FOUND') return res.status(404).json({ error: { code, message: 'Request not found.' } });
    throw e;
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
    await svc.rejectRequest(req.params.rid, req.user!.email, comment || '', req.ip);
    res.json({ data: { status: 'REJECTED' } });
  } catch (e: any) {
    const code = e?.message;
    if (code === 'ALREADY_DECIDED') return res.status(409).json({ error: { code, message: 'You already decided this request.' } });
    if (code === 'REQUEST_FINALIZED') return res.status(409).json({ error: { code, message: 'Request is no longer pending.' } });
    if (code === 'INVALID_ADMIN_EMAIL') return res.status(400).json({ error: { code, message: 'Invalid admin email.' } });
    if (code === 'REQUEST_NOT_FOUND') return res.status(404).json({ error: { code, message: 'Request not found.' } });
    throw e;
  }
});
