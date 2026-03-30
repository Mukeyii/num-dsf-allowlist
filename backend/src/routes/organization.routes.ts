import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { validate } from '../middleware/validate.middleware';
import { upsertOrganizationSchema } from '../schemas/organization.schema';
import * as svc from '../services/organization.service';
import { sanitizeError } from '../lib/sanitizeError';

export const organizationRouter = Router({ mergeParams: true });
organizationRouter.use(requireAuth, requireInstanceOwnership);

organizationRouter.get('/', async (req, res) => {
  const org = await svc.getOrganization(req.instance!.id);
  res.json({ data: org });
});

organizationRouter.put('/', validate(upsertOrganizationSchema), async (req, res) => {
  try {
    const org = await svc.upsertOrganization(
      req.instance!.id, req.body,
      req.user!.email, req.ip || 'unknown'
    );
    res.json({ data: org });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

organizationRouter.post('/request-removal', async (req, res) => {
  const { submitApproval } = await import('../services/approval.service');
  try {
    const request = await submitApproval(req.instance!.id, req.user!.email, req.ip || 'unknown');
    res.json({ data: request });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});
