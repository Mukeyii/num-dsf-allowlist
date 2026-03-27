import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import * as svc from '../services/certificate.service';
import { db } from '../db/connection';

export const certificatesRouter = Router({ mergeParams: true });
certificatesRouter.use(requireAuth, requireInstanceOwnership);

certificatesRouter.get('/', async (req, res) => {
  res.json({ data: await svc.getCertificates(req.instance!.id) });
});

certificatesRouter.get('/expiring', async (req, res) => {
  const org = await db('organizations').where({ instance_id: req.instance!.id }).first();
  if (!org) return res.json({ data: [] });
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
  const expiring = await db('certificates')
    .where({ organization_id: org.identifier })
    .where('valid_until', '<=', ninetyDaysFromNow)
    .select('id', 'subject', 'thumbprint', 'valid_until');
  res.json({ data: expiring });
});

certificatesRouter.post('/', async (req, res) => {
  const { pem } = req.body;
  if (!pem || typeof pem !== 'string') {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'PEM content required' } });
  }
  try {
    const cert = await svc.createCertificate(req.instance!.id, pem, req.user!.email, req.ip || 'unknown');
    res.status(201).json({ data: cert });
  } catch (err: any) {
    if (err.message === 'PRIVATE_KEY_REJECTED') {
      return res.status(400).json({ error: { code: 'PRIVATE_KEY_REJECTED', message: 'Private keys are not allowed' } });
    }
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

certificatesRouter.delete('/:cid', async (req, res) => {
  try {
    await svc.deleteCertificate(req.instance!.id, req.params.cid, req.user!.email, req.ip || 'unknown');
    res.json({ data: { deleted: true } });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});
