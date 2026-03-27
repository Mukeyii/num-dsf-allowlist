import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { generateBundle } from '../services/fhir.service';
import { generateIpAddressListExcel } from '../services/excel.service';

export const downloadRouter = Router({ mergeParams: true });

downloadRouter.get('/bundle', requireAuth, requireInstanceOwnership, async (req, res) => {
  const endpointId = req.query.endpointId as string;
  if (!endpointId) {
    return res.status(400).json({ error: { code: 'MISSING_ENDPOINT', message: 'endpointId required' } });
  }
  try {
    const bundle = await generateBundle(req.instance!.id, endpointId);
    res.setHeader('Content-Type', 'application/fhir+json');
    res.setHeader('Content-Disposition', `attachment; filename="allowlist-bundle-${endpointId}.json"`);
    res.json(bundle);
  } catch (err: any) {
    res.status(404).json({ error: { code: err.message, message: err.message } });
  }
});

downloadRouter.get('/ip-address-list', requireAuth, async (req, res) => {
  try {
    const buffer = await generateIpAddressListExcel();
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="dsf-ip-address-list-${date}.xlsx"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'EXPORT_FAILED', message: err.message } });
  }
});
