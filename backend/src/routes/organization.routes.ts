import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { validate } from '../middleware/validate.middleware';
import { upsertOrganizationSchema } from '../schemas/organization.schema';
import * as svc from '../services/organization.service';
import { sanitizeError } from '../lib/sanitizeError';
import { db } from '../db/connection';

export const organizationRouter = Router({ mergeParams: true });
organizationRouter.use(requireAuth, requireInstanceOwnership);

organizationRouter.get('/', async (req, res) => {
  const org = await svc.getOrganization(req.instance!.id);
  res.json({ data: org });
});

organizationRouter.put('/', validate(upsertOrganizationSchema), async (req, res) => {
  // Defense against admin planting a thumbprint on a victim org and then
  // calling /auth/client-cert-login to impersonate the victim. Admins may
  // still freely edit non-cert fields on another user's instance, but the
  // thumbprint — which is the auth credential — is locked to the owner.
  const isCrossUser = req.instance!.user_id !== req.user!.id;
  if (isCrossUser) {
    const existing = await db('organizations').where({ instance_id: req.instance!.id }).first();
    const existingThumb = existing?.client_cert_thumbprint ?? null;
    const incomingThumb = (req.body?.clientCertThumbprint ?? null) || null;
    if (existingThumb !== incomingThumb) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN_THUMBPRINT_WRITE',
          message: 'Admins cannot modify client_cert_thumbprint on another user\'s organization.',
        },
      });
    }
  }

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
