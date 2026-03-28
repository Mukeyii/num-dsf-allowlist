import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { requireImiAdmin } from '../middleware/admin.middleware';
import { otpRateLimit } from '../middleware/rateLimit.middleware';
import * as svc from '../services/approval.service';
import { verifyTotpCode } from '../services/totp.service';
import { db } from '../db/connection';

export const approvalRouter = Router({ mergeParams: true });

const totpLimiter = process.env.NODE_ENV === 'test' ? [] : [otpRateLimit];

approvalRouter.post('/submit', requireAuth, requireInstanceOwnership, async (req, res) => {
  try {
    const request = await svc.submitApproval(req.instance!.id, req.user!.email, req.ip || 'unknown');
    res.json({ data: request });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

approvalRouter.get('/status', requireAuth, requireInstanceOwnership, async (req, res) => {
  res.json({ data: await svc.getApprovalStatus(req.instance!.id) });
});

approvalRouter.get('/history', requireAuth, requireInstanceOwnership, async (req, res) => {
  res.json({ data: await svc.getApprovalHistory(req.instance!.id) });
});

approvalRouter.get('/admin/pending', requireAuth, requireImiAdmin, async (req, res) => {
  res.json({ data: await svc.getPendingApprovals() });
});

approvalRouter.post('/admin/:rid/approve', requireAuth, requireImiAdmin, ...totpLimiter, async (req, res) => {
  try {
    const { totpCode } = req.body;
    if (!totpCode) {
      res.status(400).json({ error: { code: 'TOTP_REQUIRED', message: 'Authenticator code is required to approve requests.' } });
      return;
    }

    const user = await db('users').where({ email: req.user!.email }).first();
    if (!user || !user.totp_enabled) {
      res.status(403).json({ error: { code: 'TOTP_NOT_CONFIGURED', message: 'TOTP is not configured for this account.' } });
      return;
    }

    const valid = await verifyTotpCode(user.id, totpCode);
    if (!valid) {
      res.status(401).json({ error: { code: 'TOTP_INVALID', message: 'Invalid authenticator code. Please try again.' } });
      return;
    }

    const result = await svc.approveRequest(req.params.rid, req.user!.email, req.ip || 'unknown');
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

approvalRouter.post('/admin/:rid/reject', requireAuth, requireImiAdmin, ...totpLimiter, async (req, res) => {
  try {
    const { totpCode, comment } = req.body;
    if (!totpCode) {
      res.status(400).json({ error: { code: 'TOTP_REQUIRED', message: 'Authenticator code is required to approve requests.' } });
      return;
    }

    const user = await db('users').where({ email: req.user!.email }).first();
    if (!user || !user.totp_enabled) {
      res.status(403).json({ error: { code: 'TOTP_NOT_CONFIGURED', message: 'TOTP is not configured for this account.' } });
      return;
    }

    const valid = await verifyTotpCode(user.id, totpCode);
    if (!valid) {
      res.status(401).json({ error: { code: 'TOTP_INVALID', message: 'Invalid authenticator code. Please try again.' } });
      return;
    }

    const result = await svc.rejectRequest(req.params.rid, req.user!.email, comment || '', req.ip || 'unknown');
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});
