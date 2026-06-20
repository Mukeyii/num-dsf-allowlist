/**
 * certificates.routes.ts – Certificate CRUD + renewal + expiry probe
 * Dependencies: auth/instance middleware, certificate.service, sanitizeError
 *
 * SECURITY: PEM uploads are screened by rejectPrivateKey() before any
 * parsing or storage — see certificate.service.ts.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { validate } from '../middleware/validate.middleware';
import { createCertificateSchema, renewCertificateSchema } from '../schemas/certificate.schema';
import * as svc from '../services/certificate.service';
import { db } from '../db/connection';
import { sanitizeError } from '../lib/sanitizeError';
import { asyncHandler } from '../lib/asyncHandler';

export const certificatesRouter = Router({ mergeParams: true });
certificatesRouter.use(requireAuth, requireInstanceOwnership);

certificatesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ data: await svc.getCertificates(req.instance!.id) });
  }),
);

certificatesRouter.get(
  '/expiring',
  asyncHandler(async (req, res) => {
    const org = await db('organizations').where({ instance_id: req.instance!.id }).first();
    if (!org) return res.json({ data: [] });
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    const expiring = await db('certificates')
      .where({ organization_id: org.identifier })
      .where('valid_until', '<=', ninetyDaysFromNow)
      .select('id', 'subject', 'thumbprint', 'valid_until');
    res.json({ data: expiring });
  }),
);

certificatesRouter.post('/', validate(createCertificateSchema), async (req, res) => {
  try {
    const cert = await svc.createCertificate(
      req.instance!.id,
      req.body.pem,
      req.user!.email,
      req.ip || 'unknown',
    );
    res.status(201).json({ data: cert });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'PRIVATE_KEY_REJECTED') {
      return res
        .status(400)
        .json({ error: { code: 'PRIVATE_KEY_REJECTED', message: 'Private keys are not allowed' } });
    }
    res.status(400).json({ error: { code: 'FAILED', message: 'Certificate upload failed' } });
  }
});

certificatesRouter.delete(
  '/:cid',
  asyncHandler(async (req, res) => {
    await svc.deleteCertificate(
      req.instance!.id,
      req.params.cid,
      req.user!.email,
      req.ip || 'unknown',
    );
    res.json({ data: { deleted: true } });
  }),
);

certificatesRouter.post('/:cid/renew', validate(renewCertificateSchema), async (req, res) => {
  try {
    const cert = await svc.renewCertificate(
      req.instance!.id,
      req.params.cid,
      req.body,
      req.user!.email,
      req.ip || 'unknown',
    );
    res.json({ data: cert });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'PRIVATE_KEY_REJECTED') {
      return res
        .status(400)
        .json({ error: { code: 'PRIVATE_KEY_REJECTED', message: 'Private keys are not allowed' } });
    }
    res.status(400).json({ error: sanitizeError(err) });
  }
});
