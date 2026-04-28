/**
 * cert-monitor.service.ts – Daily certificate expiry check
 * Runs as cron job daily at 08:00 UTC. Notifies SECURITY contacts.
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';

export async function runCertExpiryCheck(): Promise<void> {
  const now = new Date();
  console.log(`[CertMonitor] Running at ${now.toISOString()}`);

  const ninetyDays = new Date();
  ninetyDays.setDate(ninetyDays.getDate() + 90);

  const expiring = await db('certificates as c')
    .join('organizations as o', 'c.organization_id', 'o.identifier')
    .join('instances as i', 'o.instance_id', 'i.id')
    .where('c.valid_until', '<=', ninetyDays)
    .where('c.valid_until', '>=', now)
    .select('c.id as certId', 'c.subject', 'c.valid_until as validUntil',
      'c.last_notified_at as lastNotifiedAt',
      'o.identifier as orgIdentifier', 'o.name as orgName', 'i.id as instanceId');

  if (expiring.length === 0) {
    console.log('[CertMonitor] No expiring certificates found.');
    return;
  }

  let sent = 0;
  for (const cert of expiring) {
    const daysLeft = Math.floor((new Date(cert.validUntil).getTime() - now.getTime()) / 86400000);
    const shouldNotify = [90, 60, 30, 14, 7, 3, 1].includes(daysLeft);
    if (!shouldNotify) continue;

    // Idempotency: skip certs already notified today (UTC).
    const todayUtc = new Date(); todayUtc.setUTCHours(0, 0, 0, 0);
    if (cert.lastNotifiedAt && new Date(cert.lastNotifiedAt) >= todayUtc) {
      continue;
    }

    try {
      await writeAuditLog({
        userEmail: 'system@cert-monitor',
        instanceId: cert.instanceId,
        resourceType: 'CERTIFICATE',
        resourceId: cert.certId,
        operation: 'UPDATE',
        diffJson: { event: 'EXPIRY_WARNING', daysLeft },
        ipAddress: 'system',
      });
      await db('certificates').where({ id: cert.certId }).update({ last_notified_at: new Date() });
      console.log(`[CertMonitor] Warning: ${cert.subject} → ${daysLeft}d left`);
      sent++;
    } catch (err) {
      console.error(`[CertMonitor] Failed for ${cert.subject}:`, err);
    }
  }

  console.log(`[CertMonitor] Done. Warnings: ${sent}`);
}
