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
} from './notification.service';
import { verifyGrant } from '../lib/adminGrants';
import { v4 as uuidv4 } from 'uuid';

const SITE_NOTIFY_DELAY_MS = 30 * 60 * 1000; // 30 minutes

async function getAllAdminEmails(): Promise<string[]> {
  const rows = await db('admin_grants').select('email', 'granted_at', 'granted_by_a', 'granted_by_b', 'signature_hex');
  return rows
    .filter((r: { email: string; granted_at: Date | string; granted_by_a: string; granted_by_b: string; signature_hex: string }) =>
      verifyGrant(r),
    )
    .map((r: { email: string }) => r.email);
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
    console.warn('[ApprovalNotify] No verified admins found in admin_grants – skipping admin notification');
    return;
  }

  try {
    await sendAdminNewRequestEmail(imiEmails, orgName, orgIdentifier, submittedBy, requestId);
    console.log(`[ApprovalNotify] Notified ${imiEmails.length} admin(s) of new request from ${orgIdentifier}`);
  } catch (err) {
    console.error('[ApprovalNotify] Failed to send admin new-request email:', err);
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
    console.warn(`[ApprovalNotify] No organization found for instance ${instanceId}`);
    return;
  }

  const imiEmails = await getAllAdminEmails();
  // Immediately notify admins of the resolution
  if (imiEmails.length > 0) {
    try {
      await sendAdminApprovalResultEmail(imiEmails, org.name, org.identifier, status, resolvedBy, comment);
      console.log(`[ApprovalNotify] Notified admins of ${status} for ${org.identifier}`);
    } catch (err) {
      console.error('[ApprovalNotify] Failed to send admin approval-result email:', err);
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
    console.log(`[ApprovalNotify] Queued site notification for ${org.identifier} (${status}), due in 30 min`);
  } catch (err) {
    console.error('[ApprovalNotify] Failed to queue site notification:', err);
  }
}

export async function notifyImiOnFirstApproval(
  instanceId: string,
  firstApproverEmail: string,
  requestId: string,
): Promise<void> {
  const imiEmails = (await getAllAdminEmails()).filter(e => e.toLowerCase() !== firstApproverEmail.toLowerCase());
  if (imiEmails.length === 0) return;
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) return;
  await sendAdminFirstApprovalEmail(imiEmails, org.name, org.identifier, firstApproverEmail, requestId);
}

const REMINDER_THROTTLE_DAYS = 7;

export async function runApprovalReminders(): Promise<void> {
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
  const throttleCutoff = new Date(Date.now() - REMINDER_THROTTLE_DAYS * 86400000);

  const staleRequests = await db('approval_requests')
    .where({ status: 'PENDING' })
    .where('submitted_at', '<=', threeDaysAgo)
    .where((qb: import('knex').Knex.QueryBuilder) =>
      qb.whereNull('last_reminded_at').orWhere('last_reminded_at', '<', throttleCutoff),
    )
    .select('id', 'instance_id');

  if (staleRequests.length === 0) return;

  console.log(`[ApprovalReminder] ${staleRequests.length} stale pending request(s) – sending reminders`);

  const reminderEmails = await getAllAdminEmails();
  if (reminderEmails.length === 0) {
    console.warn('[ApprovalReminder] No verified admins found in admin_grants – skipping reminder emails');
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
      console.log(`[ApprovalReminder] Sent reminder for request ${req.id} (${orgIdentifier})`);
    } catch (err) {
      console.error(`[ApprovalReminder] Failed to send reminder for request ${req.id}:`, err);
    }
  }
}

export async function flushPendingNotifications(): Promise<void> {
  const now = new Date();
  const due = await db('pending_notifications').where('send_after', '<=', now);
  if (due.length === 0) return;

  console.log(`[PendingNotify] ${due.length} notification(s) due – flushing`);

  for (const row of due) {
    try {
      const payload = typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : row.payload_json;

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
          console.warn(`[PendingNotify] Request ${requestId} no longer exists – dropping notification ${row.id}`);
          await db('pending_notifications').where({ id: row.id }).del();
          continue;
        }
        if (request.status !== status) {
          console.log(`[PendingNotify] Request ${requestId} status changed to ${request.status} – dropping notification ${row.id}`);
          await db('pending_notifications').where({ id: row.id }).del();
          continue;
        }

        const contacts = await db('contacts')
          .where({ organization_id: payload.orgIdentifier })
          .select('email', 'name');

        if (contacts.length === 0) {
          console.warn(`[PendingNotify] No contacts for ${payload.orgIdentifier} – dropping notification ${row.id}`);
          await db('pending_notifications').where({ id: row.id }).del();
          continue;
        }

        const contactEmails = contacts.map((c: { email: string }) => c.email);
        await sendSiteApprovalResultEmail(contactEmails, orgName, status, comment);
        console.log(`[PendingNotify] Notified ${contactEmails.length} contact(s) of ${status} for ${payload.orgIdentifier}`);
      }

      await db('pending_notifications').where({ id: row.id }).del();
    } catch (err) {
      console.error(`[PendingNotify] Failed to send notification ${row.id}:`, err);
      // Leave the row for the next sweep
    }
  }
}
