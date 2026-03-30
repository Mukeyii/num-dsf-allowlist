import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import * as svc from '../services/approval.service';

export const approvalRouter = Router({ mergeParams: true });

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
