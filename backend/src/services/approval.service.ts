/**
 * approval.service.ts – Approval workflow state machine
 * Status transitions: DRAFT → PENDING (submit), PENDING → APPROVED|REJECTED (operator)
 * Dependencies: db/connection, audit.service, approval-reminder.service, lib/approvalState
 */
import { Knex } from 'knex';
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { v4 as uuidv4 } from 'uuid';
import {
  notifyImiOnSubmit,
  notifySiteOnApproval,
  notifyImiOnFirstApproval,
} from './approval-reminder.service';
import { siteOfEmail, validateApproval, deriveStatus, ApprovalSig } from '../lib/approvalState';
import { errCode } from '../lib/errMessage';
import { logger } from '../lib/logger';

// Clamp to ≥1 day. A 0 or negative value would make deriveStatus's silent-
// consent check (ageMs >= days * DAY_MS) true for a brand-new single APPROVE,
// promoting it immediately and collapsing the 4-eyes rule. Non-numeric input
// falls back to the 7-day default.
const SILENT_CONSENT_DAYS = Math.max(
  1,
  parseInt(process.env.APPROVAL_SILENT_CONSENT_DAYS || '7', 10) || 7,
);

async function buildSnapshot(instanceId: string, trx: Knex | Knex.Transaction = db) {
  const org = await trx('organizations').where({ instance_id: instanceId }).first();
  if (!org) return null;
  const contacts = await trx('contacts')
    .where({ organization_id: org.identifier })
    .select('id', 'types', 'name', 'email_validated', 'phone', 'city', 'country_code');
  const endpoints = await trx('endpoints').where({ organization_id: org.identifier });
  const ips = await trx('endpoint_ips').whereIn(
    'endpoint_id',
    endpoints.map((e: any) => e.identifier),
  );
  const certificates = await trx('certificates')
    .where({ organization_id: org.identifier })
    .select('id', 'subject', 'thumbprint', 'valid_until');
  const memberships = await trx('memberships')
    .where({ organization_id: org.identifier })
    .whereNull('deleted_at');
  const { email: _email, ...orgSafe } = org;
  return {
    organization: orgSafe,
    contacts,
    endpoints: endpoints.map((ep: any) => ({
      ...ep,
      ipAddresses: ips.filter((ip: any) => ip.endpoint_id === ep.identifier),
    })),
    certificates,
    memberships,
    snapshotAt: new Date().toISOString(),
  };
}

export async function submitApproval(instanceId: string, userEmail: string, ipAddress: string) {
  return db.transaction(async (trx) => {
    const pending = await trx('approval_requests')
      .where({ instance_id: instanceId, status: 'PENDING' })
      .forUpdate()
      .first();
    if (pending) throw new Error('APPROVAL_ALREADY_PENDING');
    const snapshot = await buildSnapshot(instanceId, trx);
    if (!snapshot) throw new Error('ORGANIZATION_NOT_FOUND');
    const id = uuidv4();
    const now = new Date();
    await trx('approval_requests').insert({
      id,
      instance_id: instanceId,
      status: 'PENDING',
      created_at: now,
      submitted_at: now,
      snapshot_json: JSON.stringify(snapshot),
    });
    await writeAuditLog({
      userEmail,
      instanceId,
      resourceType: 'APPROVAL',
      resourceId: id,
      operation: 'CREATE',
      ipAddress,
    });
    // Notify IMI (non-blocking, outside transaction scope)
    const org = snapshot.organization;
    notifyImiOnSubmit(
      id,
      instanceId,
      (org as any).identifier || instanceId,
      (org as any).name || 'Unknown',
      userEmail,
    ).catch((err) => logger.error({ err }, '[ApprovalNotify] notifyImiOnSubmit failed'));
    return trx('approval_requests').where({ id }).first();
  });
}

export async function getApprovalStatus(instanceId: string) {
  return (
    (await db('approval_requests')
      .where({ instance_id: instanceId })
      .orderBy('created_at', 'desc')
      .first()) ?? null
  );
}

export async function getApprovalHistory(instanceId: string) {
  return db('approval_requests')
    .where({ instance_id: instanceId })
    .select('id', 'status', 'created_at', 'submitted_at', 'resolved_at', 'resolved_by', 'comment')
    .orderBy('created_at', 'desc')
    .limit(20);
}

export async function getPendingApprovals() {
  return db('approval_requests').where({ status: 'PENDING' }).orderBy('submitted_at', 'asc');
}

/** Load approval signatures for many requests in one query, grouped by request id. */
export async function getSignaturesForRequests(
  requestIds: string[],
): Promise<Map<string, ApprovalSig[]>> {
  const map = new Map<string, ApprovalSig[]>();
  if (requestIds.length === 0) return map;
  const rows = (await db('approval_signatures')
    .whereIn('approval_request_id', requestIds)
    .orderBy('signed_at', 'asc')) as (ApprovalSig & { approval_request_id: string })[];
  for (const row of rows) {
    const list = map.get(row.approval_request_id);
    if (list) list.push(row);
    else map.set(row.approval_request_id, [row]);
  }
  return map;
}

export async function approveRequest(
  requestId: string,
  resolvedBy: string,
  ipAddress?: string,
): Promise<{ status: 'PENDING' | 'APPROVED'; reason?: string }> {
  const adminSite = siteOfEmail(resolvedBy);
  if (!adminSite) throw new Error('INVALID_ADMIN_EMAIL');

  // Keep the forUpdate transaction minimal: no re-SELECT of the signature we
  // just inserted, and no audit writes while the row lock is held —
  // writeAuditLog runs on the global pool, so a second connection inside the
  // transaction can starve under pool exhaustion. Audit, mails and the bundle
  // snapshot all run after commit.
  const result = await db.transaction(async (trx) => {
    // Lock the parent row so concurrent approves serialize.
    const request = await trx('approval_requests').where({ id: requestId }).forUpdate().first();
    if (!request) throw new Error('REQUEST_NOT_FOUND');
    if (request.status !== 'PENDING') throw new Error('REQUEST_FINALIZED');

    const sigs = (await trx('approval_signatures').where({
      approval_request_id: requestId,
    })) as ApprovalSig[];

    const validation = validateApproval(sigs, resolvedBy, adminSite);
    if (validation) throw new Error(validation);

    const newSig: ApprovalSig = {
      admin_email: resolvedBy,
      admin_site: adminSite,
      decision: 'APPROVE',
      signed_at: new Date(),
    };
    try {
      await trx('approval_signatures').insert({
        id: uuidv4(),
        approval_request_id: requestId,
        ...newSig,
        comment: null,
      });
    } catch (err: unknown) {
      if (errCode(err) === 'ER_DUP_ENTRY') throw new Error('ALREADY_DECIDED');
      throw err;
    }

    const newStatus = deriveStatus([...sigs, newSig], new Date(), SILENT_CONSENT_DAYS);

    if (newStatus === 'APPROVED') {
      await trx('approval_requests').where({ id: requestId }).update({
        status: 'APPROVED',
        resolved_at: new Date(),
        resolved_by: resolvedBy,
      });
      return { status: 'APPROVED' as const, instanceId: request.instance_id as string };
    }

    return {
      status: 'PENDING' as const,
      reason: 'AWAITING_SECOND_OR_SILENT_CONSENT',
      instanceId: request.instance_id as string,
    };
  });

  // After commit: audit (failure-tolerant) and fire-and-forget notifications.
  if (result.status === 'APPROVED') {
    await writeAuditLog({
      userEmail: resolvedBy,
      instanceId: result.instanceId,
      resourceType: 'APPROVAL',
      resourceId: requestId,
      operation: 'APPROVE',
      ipAddress,
    });
    notifySiteOnApproval(requestId, result.instanceId, 'APPROVED', null, resolvedBy).catch(
      () => {},
    );
  } else {
    await writeAuditLog({
      userEmail: resolvedBy,
      instanceId: result.instanceId,
      resourceType: 'APPROVAL',
      resourceId: requestId,
      operation: 'APPROVE',
      ipAddress,
      diffJson: { firstApproval: true },
    });
    notifyImiOnFirstApproval(result.instanceId, resolvedBy, requestId).catch(() => {});
  }

  // Post-commit hook: snapshot the federation-wide bundle whenever an
  // approval just transitioned the world to APPROVED. The snapshot runs
  // OUTSIDE the transaction so generateFullBundle observes the freshly
  // committed status. Failure here must not undo the approval — the
  // approval is already on disk and audited.
  if (result.status === 'APPROVED') {
    try {
      const { createSnapshot } = await import('./bundle-versions.service');
      await createSnapshot({
        triggeredBy: 'APPROVAL',
        triggeredByEmail: resolvedBy,
        approvalRequestId: requestId,
        notes: `auto-snapshot after approval ${requestId}`,
      });
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : 'unknown', requestId },
        'bundle snapshot after approval failed',
      );
    }
  }

  // instanceId is internal plumbing for the post-commit work — keep the
  // response shape unchanged for the route.
  const { instanceId: _instanceId, ...response } = result;
  return response;
}

export async function rejectRequest(
  requestId: string,
  resolvedBy: string,
  comment: string,
  ipAddress?: string,
): Promise<void> {
  const adminSite = siteOfEmail(resolvedBy);
  if (!adminSite) throw new Error('INVALID_ADMIN_EMAIL');

  // Mirror approveRequest's serialization: lock the parent row so a concurrent
  // approve (or the silent-consent sweep) cannot finalize the request between
  // our status check and the UPDATE. Without the lock, a reject could overwrite
  // an already-APPROVED request — after its signed bundle was published — to
  // REJECTED, leaving the state machine and bundle history inconsistent.
  const instanceId = await db.transaction(async (trx) => {
    const request = await trx('approval_requests').where({ id: requestId }).forUpdate().first();
    if (!request) throw new Error('REQUEST_NOT_FOUND');
    if (request.status !== 'PENDING') throw new Error('REQUEST_FINALIZED');

    try {
      await trx('approval_signatures').insert({
        id: uuidv4(),
        approval_request_id: requestId,
        admin_email: resolvedBy,
        admin_site: adminSite,
        decision: 'REJECT',
        signed_at: new Date(),
        comment,
      });
    } catch (err: unknown) {
      // UNIQUE(approval_request_id, admin_email): the same admin already signed
      // (e.g. approved then tried to reject). Map to a clean 409 instead of
      // letting the raw driver error escape as a 500 / unhandled rejection.
      if (errCode(err) === 'ER_DUP_ENTRY') throw new Error('ALREADY_DECIDED');
      throw err;
    }

    await trx('approval_requests').where({ id: requestId }).update({
      status: 'REJECTED',
      resolved_at: new Date(),
      resolved_by: resolvedBy,
      comment,
    });
    return request.instance_id as string;
  });

  // After commit: audit (non-blocking) and notify the site.
  await writeAuditLog({
    userEmail: resolvedBy,
    instanceId,
    resourceType: 'APPROVAL',
    resourceId: requestId,
    operation: 'REJECT',
    ipAddress,
    diffJson: { comment },
  });
  notifySiteOnApproval(requestId, instanceId, 'REJECTED', comment, resolvedBy).catch(() => {});
}
