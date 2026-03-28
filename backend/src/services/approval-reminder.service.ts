/**
 * approval-reminder.service.ts – Approval notification helpers
 * 1. notifyImiOnSubmit() – on new approval request
 * 2. notifySiteOnApproval() – after approve/reject
 * 3. runApprovalReminders() – cron: stale pending requests
 */
import { db } from '../db/connection';

const IMI_EMAILS = (process.env.IMI_ADMIN_EMAILS || '')
  .split(',').map(e => e.trim()).filter(Boolean);

export async function notifyImiOnSubmit(
  requestId: string, instanceId: string, orgIdentifier: string, orgName: string, submittedBy: string
): Promise<void> {
  if (IMI_EMAILS.length === 0) {
    console.warn('[ApprovalNotify] No IMI_ADMIN_EMAILS configured');
    return;
  }
  console.log(`[ApprovalNotify] New request from ${orgIdentifier} by ${submittedBy} → notifying IMI`);
}

export async function notifySiteOnApproval(
  requestId: string, instanceId: string, status: 'APPROVED' | 'REJECTED', comment: string | null, resolvedBy: string
): Promise<void> {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) return;
  const contacts = await db('contacts').where({ organization_id: org.identifier }).select('email', 'name');
  if (contacts.length === 0) {
    console.warn(`[ApprovalNotify] No contacts for ${org.identifier}`);
    return;
  }
  console.log(`[ApprovalNotify] ${status} for ${org.identifier} → notifying ${contacts.length} contacts`);
}

export async function runApprovalReminders(): Promise<void> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const stale = await db('approval_requests')
    .where({ status: 'PENDING' })
    .where('submitted_at', '<=', threeDaysAgo)
    .count('id as count');

  const count = Number(stale[0]?.count || 0);
  if (count === 0) return;
  console.log(`[ApprovalReminder] ${count} stale pending request(s)`);
}
