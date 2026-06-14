/**
 * cert-monitor.service.ts – Daily certificate expiry check
 * Runs as cron job daily at 08:00 UTC. Notifies SECURITY and DSF_ADMIN contacts.
 * Dependencies: db, audit.service, notification.service
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { sendCertExpiryWarning } from './notification.service';
import { logger } from '../lib/logger';

export async function runCertExpiryCheck(): Promise<void> {
  const now = new Date();
  logger.info(`[CertMonitor] Running at ${now.toISOString()}`);

  // Fix (b): compare valid_until (DATE) against today at UTC midnight so that
  // certs expiring today are included (not excluded because `now` is mid-day).
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const ninetyDays = new Date(today);
  ninetyDays.setDate(ninetyDays.getDate() + 90);

  const expiring = await db('certificates as c')
    .join('organizations as o', 'c.organization_id', 'o.identifier')
    .join('instances as i', 'o.instance_id', 'i.id')
    .where('c.valid_until', '<=', ninetyDays)
    .where('c.valid_until', '>=', today)
    .select(
      'c.id as certId',
      'c.subject',
      'c.valid_until as validUntil',
      'c.last_notified_at as lastNotifiedAt',
      'o.identifier as orgIdentifier',
      'o.name as orgName',
      'i.id as instanceId',
    );

  if (expiring.length === 0) {
    logger.info('[CertMonitor] No expiring certificates found.');
    return;
  }

  let sent = 0;
  for (const cert of expiring) {
    // Fix (a): use Math.ceil so a cert expiring later today counts as 0 days,
    // and a cert expiring tomorrow counts as 1 day (not 0 with floor).
    const daysLeft = Math.ceil((new Date(cert.validUntil).getTime() - today.getTime()) / 86400000);
    const shouldNotify = [90, 60, 30, 14, 7, 3, 1, 0].includes(daysLeft);
    if (!shouldNotify) continue;

    // Idempotency: skip certs already notified today (UTC).
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    if (cert.lastNotifiedAt && new Date(cert.lastNotifiedAt) >= todayUtc) {
      continue;
    }

    try {
      // Fix (c): look up SECURITY and DSF_ADMIN contacts and send them an email.
      const contacts: Array<{ email: string; types: string | string[] }> = await db('contacts')
        .where({ organization_id: cert.orgIdentifier })
        .select('email', 'types');

      // Parse each contact's types in its own guard so one corrupt `types`
      // JSON row can't suppress notifications to the cert's other recipients.
      const recipientEmails: string[] = [];
      for (const c of contacts) {
        let types: string[];
        try {
          types = typeof c.types === 'string' ? JSON.parse(c.types) : c.types;
        } catch (parseErr) {
          logger.warn(
            { parseErr, email: c.email, org: cert.orgIdentifier },
            '[CertMonitor] Skipping contact with malformed types JSON',
          );
          continue;
        }
        if (Array.isArray(types) && (types.includes('SECURITY') || types.includes('DSF_ADMIN'))) {
          recipientEmails.push(c.email);
        }
      }

      for (const email of recipientEmails) {
        await sendCertExpiryWarning(email, {
          orgName: cert.orgName,
          orgIdentifier: cert.orgIdentifier,
          subject: cert.subject ?? '',
          daysLeft,
          validUntil:
            cert.validUntil instanceof Date
              ? cert.validUntil.toISOString().slice(0, 10)
              : String(cert.validUntil).slice(0, 10),
        });
      }

      await writeAuditLog({
        userEmail: 'system@cert-monitor',
        instanceId: cert.instanceId,
        resourceType: 'CERTIFICATE',
        resourceId: cert.certId,
        operation: 'UPDATE',
        diffJson: { event: 'EXPIRY_WARNING', daysLeft, notifiedCount: recipientEmails.length },
        ipAddress: 'system',
      });
      await db('certificates').where({ id: cert.certId }).update({ last_notified_at: new Date() });
      logger.info(
        `[CertMonitor] Warning: ${cert.subject} → ${daysLeft}d left (notified ${recipientEmails.length})`,
      );
      sent++;
    } catch (err) {
      logger.error({ err, subject: cert.subject }, '[CertMonitor] Failed to process certificate');
    }
  }

  logger.info(`[CertMonitor] Done. Warnings: ${sent}`);
}
