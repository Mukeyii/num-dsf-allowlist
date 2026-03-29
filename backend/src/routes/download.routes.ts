import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { generateBundle } from '../services/fhir.service';
import { generateIpAddressListExcel } from '../services/excel.service';
import { signBundle } from '../services/bundle-signing.service';
import { writeAuditLog } from '../services/audit.service';

export const downloadRouter = Router({ mergeParams: true });

downloadRouter.get('/bundle', requireAuth, requireInstanceOwnership, async (req, res) => {
  const endpointId = req.query.endpointId as string;
  if (!endpointId) {
    return res.status(400).json({ error: { code: 'MISSING_ENDPOINT', message: 'endpointId required' } });
  }
  try {
    const bundle = await generateBundle(req.instance!.id, endpointId);
    const { signature, contentHash } = signBundle(bundle);
    res.setHeader('Content-Type', 'application/fhir+json');
    res.setHeader('Content-Disposition', `attachment; filename="allowlist-bundle-${endpointId}.json"`);
    res.setHeader('X-Bundle-Signature', signature);
    res.setHeader('X-Content-Hash', contentHash);

    writeAuditLog({
      userEmail: req.user!.email,
      instanceId: req.instance!.id,
      resourceType: 'CERTIFICATE',
      resourceId: endpointId,
      operation: 'CREATE',
      diffJson: { contentHash, action: 'bundle_download' },
      ipAddress: req.ip || 'unknown',
    }).catch(() => {});

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
