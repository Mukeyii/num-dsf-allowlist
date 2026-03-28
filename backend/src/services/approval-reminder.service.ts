/**
 * approval-reminder.service.ts – Approval notification helpers
 * Dependencies: db/connection, notification.service
 *
 * 1. notifyImiOnSubmit()    – on new approval request submitted
 * 2. notifySiteOnApproval() – after approve/reject (site contacts notified after 30-min delay)
 * 3. runApprovalReminders() – cron: send reminders for stale pending requests
 */
import { db } from '../db/connection';
import {
  sendAdminNewRequestEmail,
  sendAdminApprovalResultEmail,
  sendSiteApprovalResultEmail,
} from './notification.service';

const SITE_NOTIFY_DELAY_MS = 30 * 60 * 1000; // 30 minutes

const IMI_EMAILS = (process.env.IMI_ADMIN_EMAILS || '')
  .split(',').map(e => e.trim()).filter(Boolean);

export async function notifyImiOnSubmit(
  requestId: string,
  instanceId: string,
  orgIdentifier: string,
  orgName: string,
  submittedBy: string,
): Promise<void> {
  if (IMI_EMAILS.length === 0) {
    console.warn('[ApprovalNotify] No IMI_ADMIN_EMAILS configured – skipping admin notification');
    return;
  }

  try {
    await sendAdminNewRequestEmail(IMI_EMAILS, orgName, orgIdentifier, submittedBy, requestId);
    console.log(`[ApprovalNotify] Notified ${IMI_EMAILS.length} admin(s) of new request from ${orgIdentifier}`);
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

  // Immediately notify admins of the resolution
  if (IMI_EMAILS.length > 0) {
    try {
      await sendAdminApprovalResultEmail(IMI_EMAILS, org.name, org.identifier, status, resolvedBy, comment);
      console.log(`[ApprovalNotify] Notified admins of ${status} for ${org.identifier}`);
    } catch (err) {
      console.error('[ApprovalNotify] Failed to send admin approval-result email:', err);
    }
  }

  // Notify site contacts after a 30-minute delay (allows time to reverse the decision)
  setTimeout(async () => {
    try {
      // Re-check request status before sending – skip if it has changed
      const request = await db('approval_requests').where({ id: requestId }).first();
      if (!request) {
        console.warn(`[ApprovalNotify] Request ${requestId} no longer exists – skipping site notification`);
        return;
      }
      if (request.status !== status) {
        console.log(`[ApprovalNotify] Request ${requestId} status changed to ${request.status} – skipping site notification`);
        return;
      }

      const contacts = await db('contacts')
        .where({ organization_id: org.identifier })
        .select('email', 'name');

      if (contacts.length === 0) {
        console.warn(`[ApprovalNotify] No contacts for ${org.identifier} – skipping site notification`);
        return;
      }

      const contactEmails = contacts.map((c: { email: string }) => c.email);
      await sendSiteApprovalResultEmail(contactEmails, org.name, status, comment);
      console.log(`[ApprovalNotify] Notified ${contactEmails.length} contact(s) of ${status} for ${org.identifier}`);
    } catch (err) {
      console.error('[ApprovalNotify] Failed to send site approval-result email:', err);
    }
  }, SITE_NOTIFY_DELAY_MS);
}

export async function runApprovalReminders(): Promise<void> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const staleRequests = await db('approval_requests')
    .where({ status: 'PENDING' })
    .where('submitted_at', '<=', threeDaysAgo)
    .select('id', 'instance_id');

  if (staleRequests.length === 0) return;

  console.log(`[ApprovalReminder] ${staleRequests.length} stale pending request(s) – sending reminders`);

  if (IMI_EMAILS.length === 0) {
    console.warn('[ApprovalReminder] No IMI_ADMIN_EMAILS configured – skipping reminder emails');
    return;
  }

  for (const req of staleRequests) {
    try {
      const org = await db('organizations').where({ instance_id: req.instance_id }).first();
      const orgName = org?.name ?? 'Unknown';
      const orgIdentifier = org?.identifier ?? req.instance_id;

      // Re-use sendAdminNewRequestEmail as a reminder (submittedBy = 'reminder')
      await sendAdminNewRequestEmail(
        IMI_EMAILS,
        orgName,
        orgIdentifier,
        'Automated reminder – request still pending',
        req.id,
      );
      console.log(`[ApprovalReminder] Sent reminder for request ${req.id} (${orgIdentifier})`);
    } catch (err) {
      console.error(`[ApprovalReminder] Failed to send reminder for request ${req.id}:`, err);
    }
  }
}
