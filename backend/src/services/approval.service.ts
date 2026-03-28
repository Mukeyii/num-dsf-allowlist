/**
 * approval.service.ts – Approval workflow state machine
 * Status transitions: DRAFT → PENDING (submit), PENDING → APPROVED|REJECTED (operator)
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { v4 as uuidv4 } from 'uuid';
import { notifyImiOnSubmit, notifySiteOnApproval } from './approval-reminder.service';

async function buildSnapshot(instanceId: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) return null;
  const contacts = await db('contacts').where({ organization_id: org.identifier }).select('id', 'types', 'name', 'email_validated', 'phone', 'city', 'country_code');
  const endpoints = await db('endpoints').where({ organization_id: org.identifier });
  const ips = await db('endpoint_ips').whereIn('endpoint_id', endpoints.map((e: any) => e.identifier));
  const certificates = await db('certificates').where({ organization_id: org.identifier }).select('id', 'subject', 'thumbprint', 'valid_until');
  const memberships = await db('memberships').where({ organization_id: org.identifier });
  return {
    organization: org, contacts,
    endpoints: endpoints.map((ep: any) => ({ ...ep, ipAddresses: ips.filter((ip: any) => ip.endpoint_id === ep.identifier) })),
    certificates, memberships, snapshotAt: new Date().toISOString(),
  };
}

export async function submitApproval(instanceId: string, userEmail: string, ipAddress: string) {
  const pending = await db('approval_requests').where({ instance_id: instanceId, status: 'PENDING' }).first();
  if (pending) throw new Error('APPROVAL_ALREADY_PENDING');
  const snapshot = await buildSnapshot(instanceId);
  if (!snapshot) throw new Error('ORGANIZATION_NOT_FOUND');
  const id = uuidv4();
  const now = new Date();
  await db('approval_requests').insert({ id, instance_id: instanceId, status: 'PENDING', created_at: now, submitted_at: now, snapshot_json: JSON.stringify(snapshot) });
  await writeAuditLog({ userEmail, instanceId, resourceType: 'APPROVAL', resourceId: id, operation: 'CREATE', ipAddress });
  // Notify IMI (non-blocking)
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  notifyImiOnSubmit(id, instanceId, org?.identifier || instanceId, org?.name || 'Unknown', userEmail).catch(err => console.error('[ApprovalNotify]', err));
  return db('approval_requests').where({ id }).first();
}

export async function getApprovalStatus(instanceId: string) {
  return await db('approval_requests').where({ instance_id: instanceId }).orderBy('created_at', 'desc').first() ?? null;
}

export async function getApprovalHistory(instanceId: string) {
  return db('approval_requests').where({ instance_id: instanceId }).select('id', 'status', 'created_at', 'submitted_at', 'resolved_at', 'resolved_by', 'comment').orderBy('created_at', 'desc').limit(20);
}

export async function getPendingApprovals() {
  return db('approval_requests').where({ status: 'PENDING' }).orderBy('submitted_at', 'asc');
}

export async function approveRequest(requestId: string, resolvedBy: string, ipAddress: string) {
  const request = await db('approval_requests').where({ id: requestId, status: 'PENDING' }).first();
  if (!request) throw new Error('REQUEST_NOT_FOUND');
  await db('approval_requests').where({ id: requestId }).update({ status: 'APPROVED', resolved_at: new Date(), resolved_by: resolvedBy });
  await writeAuditLog({ userEmail: resolvedBy, instanceId: request.instance_id, resourceType: 'APPROVAL', resourceId: requestId, operation: 'APPROVE', ipAddress });
  notifySiteOnApproval(requestId, request.instance_id, 'APPROVED', null, resolvedBy).catch(err => console.error('[ApprovalNotify]', err));
  return db('approval_requests').where({ id: requestId }).first();
}

export async function rejectRequest(requestId: string, resolvedBy: string, comment: string, ipAddress: string) {
  const request = await db('approval_requests').where({ id: requestId, status: 'PENDING' }).first();
  if (!request) throw new Error('REQUEST_NOT_FOUND');
  await db('approval_requests').where({ id: requestId }).update({ status: 'REJECTED', resolved_at: new Date(), resolved_by: resolvedBy, comment });
  await writeAuditLog({ userEmail: resolvedBy, instanceId: request.instance_id, resourceType: 'APPROVAL', resourceId: requestId, operation: 'REJECT', diffJson: { comment }, ipAddress });
  notifySiteOnApproval(requestId, request.instance_id, 'REJECTED', comment, resolvedBy).catch(err => console.error('[ApprovalNotify]', err));
  return db('approval_requests').where({ id: requestId }).first();
}
