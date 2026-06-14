/**
 * approval-reminder.service.ts – Approval notification helpers
 * Dependencies: db/connection, notification.service, lib/adminGrants, uuid
 *
 * 1. notifyImiOnSubmit()         – on new approval request submitted
 * 2. notifySiteOnApproval()      – after approve/reject (inserts pending_notification row, 30-min delay)
 * 3. runApprovalReminders()      – cron: send reminders for stale pending requests
 * 4. flushPendingNotifications() – cron (every 5 min): deliver due pending_notifications rows
 */
import { db } from '../db/connection';
import {
  sendAdminNewRequestEmail,
  sendAdminApprovalResultEmail,
  sendAdminFirstApprovalEmail,
  sendSiteApprovalResultEmail,
  sendApprovedBundleNotification,
} from './notification.service';
import { listVerifiedAdminEmails } from '../lib/adminGrants';
import { v4 as uuidv4 } from 'uuid';
import { KEY_ID } from './bundle-signing.service';
import { SITE_NOTIFY_DELAY_MS, DAY_MS, REMINDER_THROTTLE_MS } from '../lib/time';
import { logger } from '../lib/logger';

async function getAllAdminEmails(): Promise<string[]> {
  return listVerifiedAdminEmails();
}

export async function notifyImiOnSubmit(
  requestId: string,
  instanceId: string,
  orgIdentifier: string,
  orgName: string,
  submittedBy: string,
): Promise<void> {
  const imiEmails = await getAllAdminEmails();
  if (imiEmails.length === 0) {
    logger.warn(
      '[ApprovalNotify] No verified admins found in admin_grants – skipping admin notification',
    );
    return;
  }

  try {
    await sendAdminNewRequestEmail(imiEmails, orgName, orgIdentifier, submittedBy, requestId);
    logger.info(
      `[ApprovalNotify] Notified ${imiEmails.length} admin(s) of new request from ${orgIdentifier}`,
    );
  } catch (err) {
    logger.error({ err }, '[ApprovalNotify] Failed to send admin new-request email');
  }
}

export async function notifySiteOnApproval(
  requestId: string,
  instanceId: string,
  status: 'APPROVED' | 'REJECTED',
  comment: string | null,
  resolvedBy: string,
): Promise<void> {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) {
    logger.warn(`[ApprovalNotify] No organization found for instance ${instanceId}`);
    return;
  }

  const imiEmails = await getAllAdminEmails();
  // Immediately notify admins of the resolution
  if (imiEmails.length > 0) {
    try {
      await sendAdminApprovalResultEmail(
        imiEmails,
        org.name,
        org.identifier,
        status,
        resolvedBy,
        comment,
      );
      logger.info(`[ApprovalNotify] Notified admins of ${status} for ${org.identifier}`);
    } catch (err) {
      logger.error({ err }, '[ApprovalNotify] Failed to send admin approval-result email');
    }
  }

  // Persist the delayed site notification so it survives process restarts
  try {
    await db('pending_notifications').insert({
      id: uuidv4(),
      kind: 'SITE_APPROVAL',
      target_email: org.email,
      payload_json: JSON.stringify({
        requestId,
        instanceId,
        orgIdentifier: org.identifier,
        orgName: org.name,
        status,
        comment,
      }),
      send_after: new Date(Date.now() + SITE_NOTIFY_DELAY_MS),
      created_at: new Date(),
    });
    logger.info(
      `[ApprovalNotify] Queued site notification for ${org.identifier} (${status}), due in 30 min`,
    );
  } catch (err) {
    logger.error({ err }, '[ApprovalNotify] Failed to queue site notification');
  }
}

export async function notifyImiOnFirstApproval(
  instanceId: string,
  firstApproverEmail: string,
  requestId: string,
): Promise<void> {
  const imiEmails = (await getAllAdminEmails()).filter(
    (e) => e.toLowerCase() !== firstApproverEmail.toLowerCase(),
  );
  if (imiEmails.length === 0) return;
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) return;
  await sendAdminFirstApprovalEmail(
    imiEmails,
    org.name,
    org.identifier,
    firstApproverEmail,
    requestId,
  );
}

export async function runApprovalReminders(): Promise<void> {
  const threeDaysAgo = new Date(Date.now() - 3 * DAY_MS);
  const throttleCutoff = new Date(Date.now() - REMINDER_THROTTLE_MS);

  const staleRequests = await db('approval_requests')
    .where({ status: 'PENDING' })
    .where('submitted_at', '<=', threeDaysAgo)
    .where((qb: import('knex').Knex.QueryBuilder) =>
      qb.whereNull('last_reminded_at').orWhere('last_reminded_at', '<', throttleCutoff),
    )
    .select('id', 'instance_id');

  if (staleRequests.length === 0) return;

  logger.info(
    `[ApprovalReminder] ${staleRequests.length} stale pending request(s) – sending reminders`,
  );

  const reminderEmails = await getAllAdminEmails();
  if (reminderEmails.length === 0) {
    logger.warn(
      '[ApprovalReminder] No verified admins found in admin_grants – skipping reminder emails',
    );
    return;
  }

  for (const req of staleRequests) {
    try {
      const org = await db('organizations').where({ instance_id: req.instance_id }).first();
      const orgName = org?.name ?? 'Unknown';
      const orgIdentifier = org?.identifier ?? req.instance_id;

      // Re-use sendAdminNewRequestEmail as a reminder (submittedBy = 'reminder')
      await sendAdminNewRequestEmail(
        reminderEmails,
        orgName,
        orgIdentifier,
        'Automated reminder – request still pending',
        req.id,
      );
      await db('approval_requests').where({ id: req.id }).update({ last_reminded_at: new Date() });
      logger.info(`[ApprovalReminder] Sent reminder for request ${req.id} (${orgIdentifier})`);
    } catch (err) {
      logger.error({ err, requestId: req.id }, '[ApprovalReminder] Failed to send reminder');
    }
  }
}

export async function flushPendingNotifications(): Promise<void> {
  const now = new Date();
  const due = await db('pending_notifications').where('send_after', '<=', now);
  if (due.length === 0) return;

  logger.info(`[PendingNotify] ${due.length} notification(s) due – flushing`);

  for (const row of due) {
    try {
      const payload =
        typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json;

      if (row.kind === 'SITE_APPROVAL') {
        const { requestId, instanceId, orgName, status, comment } = payload as {
          requestId: string;
          instanceId: string;
          orgIdentifier: string;
          orgName: string;
          status: 'APPROVED' | 'REJECTED';
          comment: string | null;
        };

        // Re-check request status before sending – drop the notification if it has changed
        const request = await db('approval_requests').where({ id: requestId }).first();
        if (!request) {
          logger.warn(
            `[PendingNotify] Request ${requestId} no longer exists – dropping notification ${row.id}`,
          );
          await db('pending_notifications').where({ id: row.id }).del();
          continue;
        }
        if (request.status !== status) {
          logger.info(
            `[PendingNotify] Request ${requestId} status changed to ${request.status} – dropping notification ${row.id}`,
          );
          await db('pending_notifications').where({ id: row.id }).del();
          continue;
        }

        const contacts = await db('contacts')
          .where({ organization_id: payload.orgIdentifier })
          .select('email', 'name', 'language');

        if (contacts.length === 0) {
          logger.warn(
            `[PendingNotify] No contacts for ${payload.orgIdentifier} – dropping notification ${row.id}`,
          );
          await db('pending_notifications').where({ id: row.id }).del();
          continue;
        }

        if (status === 'APPROVED') {
          // Look up the snapshot the approval triggered. If it's missing
          // (snapshot service failed earlier), fall back to the legacy mail
          // so the site is still notified.
          const latest = await db('bundle_versions')
            .where({ approval_request_id: requestId })
            .orderBy('version_number', 'desc')
            .first();
          if (!latest) {
            const contactEmails = contacts.map((c: { email: string }) => c.email);
            await sendSiteApprovalResultEmail(contactEmails, orgName, status, comment);
            logger.warn(
              `[PendingNotify] No bundle_versions row for request ${requestId} — sent legacy mail`,
            );
          } else {
            // Diff against the previous version for added/removed/changed counts.
            const previous = await db('bundle_versions')
              .where('version_number', '<', latest.version_number)
              .orderBy('version_number', 'desc')
              .first();
            let changes = { addedOrgs: 0, removedOrgs: 0, changedOrgs: 0 };
            if (previous) {
              try {
                const { diffVersions } = await import('./bundle-versions.service');
                const diff = await diffVersions(previous.id, latest.id);
                changes = {
                  addedOrgs: diff.added.length,
                  removedOrgs: diff.removed.length,
                  changedOrgs: diff.changed.length,
                };
              } catch (e) {
                logger.warn(
                  { err: e },
                  '[PendingNotify] diffVersions failed, sending mail without diff',
                );
              }
            }

            // Pick a representative endpoint for the headline. Sites with
            // multiple endpoints still get a single mail; the recipient can
            // see the rest by clicking the verify link.
            const ep = await db('endpoints')
              .where({ organization_id: payload.orgIdentifier })
              .orderBy('created_at', 'asc')
              .first();
            const endpointIdentifier = ep?.identifier ?? payload.orgIdentifier;

            const portalUrl = process.env.FRONTEND_URL || 'http://localhost';
            const apiBase = process.env.API_BASE_URL || `${portalUrl}/api/v1`;
            const supportEmail =
              process.env.OPERATOR_SUPPORT_EMAIL || 'noreply@dsf-allowlist.local';
            // Stamp the same kid the bundle JWT carries so the value in the
            // mail matches the header the recipient inspects offline.
            const signatureKid = KEY_ID;

            for (const c of contacts as Array<{
              email: string;
              name: string | null;
              language: string;
            }>) {
              const language: 'en' | 'de' = c.language === 'de' ? 'de' : 'en';
              try {
                await sendApprovedBundleNotification(
                  { email: c.email, name: c.name, language },
                  {
                    endpointIdentifier,
                    environment:
                      process.env.DSF_ENVIRONMENT === 'PRODUCTION' ? 'PRODUCTION' : 'TEST',
                    portalUrl,
                    bundleVersionNumber: latest.version_number,
                    contentHash: latest.content_hash,
                    signatureKid,
                    changes,
                    downloadUrl: `${apiBase}/admin/bundle-versions/${latest.id}/download`,
                    verifyUrl: `${portalUrl}/app/admin/bundle-versions`,
                    supportEmail,
                  },
                );
              } catch (e) {
                logger.error(
                  { err: e, email: c.email },
                  '[PendingNotify] sendApprovedBundleNotification failed',
                );
              }
            }
            logger.info(
              `[PendingNotify] Notified ${contacts.length} contact(s) of APPROVED v${latest.version_number} for ${payload.orgIdentifier}`,
            );
          }
        } else {
          const contactEmails = contacts.map((c: { email: string }) => c.email);
          await sendSiteApprovalResultEmail(contactEmails, orgName, status, comment);
          logger.info(
            `[PendingNotify] Notified ${contactEmails.length} contact(s) of REJECTED for ${payload.orgIdentifier}`,
          );
        }
      }

      await db('pending_notifications').where({ id: row.id }).del();
    } catch (err) {
      logger.error({ err, notificationId: row.id }, '[PendingNotify] Failed to send notification');
      // Leave the row for the next sweep
    }
  }
}
