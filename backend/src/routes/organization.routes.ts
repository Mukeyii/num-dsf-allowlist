/**
 * organization.routes.ts – Organization upsert + removal-request
 * Dependencies: auth/instance middleware, organization.service, schema, sanitizeError
 *
 * client_cert_thumbprint writes are gated by an admin-vs-owner check
 * (FORBIDDEN_THUMBPRINT_WRITE) so an admin's session can't plant a
 * thumbprint on a victim org.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { validate } from '../middleware/validate.middleware';
import { upsertOrganizationSchema } from '../schemas/organization.schema';
import * as svc from '../services/organization.service';
import { asyncHandler } from '../lib/asyncHandler';
import { db } from '../db/connection';
import { verifyTotpCode } from '../services/totp.service';

export const organizationRouter = Router({ mergeParams: true });
organizationRouter.use(requireAuth, requireInstanceOwnership);

organizationRouter.get('/', async (req, res) => {
  const org = await svc.getOrganization(req.instance!.id);
  res.json({ data: org });
});

organizationRouter.put('/', validate(upsertOrganizationSchema), asyncHandler(async (req, res) => {
  const existingOrgRow = await db('organizations').where({ instance_id: req.instance!.id }).first();
  const existingThumb = existingOrgRow?.client_cert_thumbprint ?? null;
  const incomingThumb = (req.body?.clientCertThumbprint ?? null) || null;

  // TOTP required when the owner is changing client_cert_thumbprint.
  // Same-value re-saves (unchanged form submit) are allowed without TOTP.
  const isCrossUser = req.instance!.user_id !== req.user!.id;
  if (!isCrossUser && existingThumb !== incomingThumb) {
    const code = req.body?.totpCode;
    if (!code || typeof code !== 'string' || code.length !== 6) {
      return res.status(400).json({ error: { code: 'TOTP_REQUIRED', message: 'TOTP required to change client_cert_thumbprint' } });
    }
    const ok = await verifyTotpCode(req.user!.id, code);
    if (!ok) {
      return res.status(401).json({ error: { code: 'TOTP_INVALID', message: 'Invalid TOTP code' } });
    }
  }

  // Defense against admin planting a thumbprint on a victim org and then
  // calling /auth/client-cert-login to impersonate the victim. Admins may
  // still freely edit non-cert fields on another user's instance, but the
  // thumbprint — which is the auth credential — is locked to the owner.
  if (isCrossUser && existingThumb !== incomingThumb) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN_THUMBPRINT_WRITE',
        message: 'Admins cannot modify client_cert_thumbprint on another user\'s organization.',
      },
    });
  }

  const org = await svc.upsertOrganization(
    req.instance!.id, req.body,
    req.user!.email, req.ip || 'unknown'
  );
  res.json({ data: org });
}));

organizationRouter.post('/request-removal', asyncHandler(async (req, res) => {
  const { submitApproval } = await import('../services/approval.service');
  const request = await submitApproval(req.instance!.id, req.user!.email, req.ip || 'unknown');
  res.json({ data: request });
}));
