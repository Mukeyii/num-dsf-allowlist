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
import { logger } from '../lib/logger';

const SILENT_CONSENT_DAYS = parseInt(process.env.APPROVAL_SILENT_CONSENT_DAYS || '7', 10);

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

export async function getSignatures(requestId: string): Promise<ApprovalSig[]> {
  return db('approval_signatures')
    .where({ approval_request_id: requestId })
    .orderBy('signed_at', 'asc');
}

export async function approveRequest(
  requestId: string,
  resolvedBy: string,
  ipAddress?: string,
): Promise<{ status: 'PENDING' | 'APPROVED'; reason?: string }> {
  const adminSite = siteOfEmail(resolvedBy);
  if (!adminSite) throw new Error('INVALID_ADMIN_EMAIL');

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

    try {
      await trx('approval_signatures').insert({
        id: uuidv4(),
        approval_request_id: requestId,
        admin_email: resolvedBy,
        admin_site: adminSite,
        decision: 'APPROVE',
        signed_at: new Date(),
        comment: null,
      });
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') throw new Error('ALREADY_DECIDED');
      throw err;
    }

    const refreshed = (await trx('approval_signatures').where({
      approval_request_id: requestId,
    })) as ApprovalSig[];
    const newStatus = deriveStatus(refreshed, new Date(), SILENT_CONSENT_DAYS);

    if (newStatus === 'APPROVED') {
      await trx('approval_requests').where({ id: requestId }).update({
        status: 'APPROVED',
        resolved_at: new Date(),
        resolved_by: resolvedBy,
      });
      await writeAuditLog({
        userEmail: resolvedBy,
        instanceId: request.instance_id,
        resourceType: 'APPROVAL',
        resourceId: requestId,
        operation: 'APPROVE',
        ipAddress,
      });
      notifySiteOnApproval(requestId, request.instance_id, 'APPROVED', null, resolvedBy).catch(
        () => {},
      );
      return { status: 'APPROVED' as const };
    }

    await writeAuditLog({
      userEmail: resolvedBy,
      instanceId: request.instance_id,
      resourceType: 'APPROVAL',
      resourceId: requestId,
      operation: 'APPROVE',
      ipAddress,
      diffJson: { firstApproval: true },
    });
    notifyImiOnFirstApproval(request.instance_id, resolvedBy, requestId).catch(() => {});
    return { status: 'PENDING' as const, reason: 'AWAITING_SECOND_OR_SILENT_CONSENT' };
  });

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

  return result;
}

export async function rejectRequest(
  requestId: string,
  resolvedBy: string,
  comment: string,
  ipAddress?: string,
): Promise<void> {
  const adminSite = siteOfEmail(resolvedBy);
  if (!adminSite) throw new Error('INVALID_ADMIN_EMAIL');

  const request = await db('approval_requests').where({ id: requestId }).first();
  if (!request) throw new Error('REQUEST_NOT_FOUND');
  if (request.status !== 'PENDING') throw new Error('REQUEST_FINALIZED');

  await db('approval_signatures').insert({
    id: uuidv4(),
    approval_request_id: requestId,
    admin_email: resolvedBy,
    admin_site: adminSite,
    decision: 'REJECT',
    signed_at: new Date(),
    comment,
  });

  await db('approval_requests').where({ id: requestId }).update({
    status: 'REJECTED',
    resolved_at: new Date(),
    resolved_by: resolvedBy,
    comment,
  });

  await writeAuditLog({
    userEmail: resolvedBy,
    instanceId: request.instance_id,
    resourceType: 'APPROVAL',
    resourceId: requestId,
    operation: 'REJECT',
    ipAddress,
    diffJson: { comment },
  });
  notifySiteOnApproval(requestId, request.instance_id, 'REJECTED', comment, resolvedBy).catch(
    () => {},
  );
}
