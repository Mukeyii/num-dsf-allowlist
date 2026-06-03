/**
 * approval-silent-consent.service.ts – Daily job that promotes approval
 * requests with exactly one APPROVE signature older than the silent-consent
 * window (default 7 days, configurable via APPROVAL_SILENT_CONSENT_DAYS) to
 * APPROVED. Implements "Schweigen als Zustimmung".
 *
 * Dependencies: db/connection, audit.service, approval-reminder.service, lib/approvalState
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { notifySiteOnApproval } from './approval-reminder.service';
import { ApprovalSig } from '../lib/approvalState';

const SILENT_CONSENT_DAYS = parseInt(process.env.APPROVAL_SILENT_CONSENT_DAYS || '7', 10);

export async function runSilentConsentSweep(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SILENT_CONSENT_DAYS * 86400_000);
  const pending = await db('approval_requests').where({ status: 'PENDING' });

  let promoted = 0;
  for (const r of pending) {
    const sigs = (await db('approval_signatures').where({
      approval_request_id: r.id,
    })) as ApprovalSig[];
    if (sigs.some((s) => s.decision === 'REJECT')) continue;
    const approves = sigs.filter((s) => s.decision === 'APPROVE');
    if (approves.length === 0) continue;
    if (approves.length >= 2) continue; // already at 2 — derived elsewhere

    const first = approves[0];
    const firstAt = new Date(first.signed_at);
    if (firstAt > cutoff) continue;

    const updated = await db('approval_requests').where({ id: r.id, status: 'PENDING' }).update({
      status: 'APPROVED',
      resolved_at: now,
      resolved_by: 'SYSTEM:silent-consent',
    });
    if (updated === 0) continue; // race: someone resolved this request first
    await writeAuditLog({
      userEmail: 'SYSTEM:silent-consent',
      instanceId: r.instance_id,
      resourceType: 'APPROVAL',
      resourceId: r.id,
      operation: 'APPROVE',
      diffJson: {
        silentConsent: true,
        firstApprover: first.admin_email,
        firstApprovedAt: firstAt.toISOString(),
      },
    });

    // notifySiteOnApproval signature: (requestId, instanceId, status, comment, resolvedBy)
    notifySiteOnApproval(r.id, r.instance_id, 'APPROVED', null, 'SYSTEM:silent-consent').catch(
      () => {},
    );
    promoted++;
  }
  return promoted;
}
