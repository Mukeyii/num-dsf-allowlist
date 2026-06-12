/**
 * approval-silent-consent.service.ts – Daily job that promotes approval
 * requests with exactly one APPROVE signature older than the silent-consent
 * window (default 7 days, configurable via APPROVAL_SILENT_CONSENT_DAYS) to
 * APPROVED. Implements "Schweigen als Zustimmung".
 *
 * Dependencies: db/connection, audit.service, approval-reminder.service,
 * bundle-versions.service (dynamic), lib/approvalState, lib/isAdmin, lib/logger
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { notifySiteOnApproval } from './approval-reminder.service';
import { ApprovalSig } from '../lib/approvalState';
import { isAdminEmail } from '../lib/isAdmin';
import { logger } from '../lib/logger';

// Clamp to ≥1 day so a 0/negative env value cannot promote a fresh single
// APPROVE on the nightly sweep (mirrors approval.service.ts). Non-numeric
// input falls back to the 7-day default.
const SILENT_CONSENT_DAYS = Math.max(
  1,
  parseInt(process.env.APPROVAL_SILENT_CONSENT_DAYS || '7', 10) || 7,
);

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

    // The signer must STILL be a verified admin — their grant may have been
    // revoked for cause during the silent-consent window.
    if (!(await isAdminEmail(first.admin_email))) {
      logger.info(
        { requestId: r.id, approver: first.admin_email },
        'silent-consent promotion skipped: approver is no longer a verified admin',
      );
      continue;
    }

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

    // Mirror approveRequest's post-commit hook: persist a signed bundle
    // snapshot so silent-consent approvals also get a bundle_versions row
    // (otherwise flushPendingNotifications degrades to the legacy mail).
    // Failure must not abort the sweep — the promotion is already committed.
    try {
      const { createSnapshot } = await import('./bundle-versions.service');
      await createSnapshot({
        triggeredBy: 'APPROVAL',
        triggeredByEmail: 'SYSTEM:silent-consent',
        approvalRequestId: r.id,
        notes: `auto-snapshot after silent-consent approval ${r.id}`,
      });
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : 'unknown', requestId: r.id },
        'bundle snapshot after silent-consent promotion failed',
      );
    }

    // notifySiteOnApproval signature: (requestId, instanceId, status, comment, resolvedBy)
    notifySiteOnApproval(r.id, r.instance_id, 'APPROVED', null, 'SYSTEM:silent-consent').catch(
      () => {},
    );
    promoted++;
  }
  return promoted;
}
