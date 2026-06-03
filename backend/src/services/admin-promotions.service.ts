/**
 * admin-promotions.service.ts – 4-eyes admin promotion lifecycle.
 * Requester creates a request; second admin from a DIFFERENT site approves;
 * NO silent-consent timer (explicit approval only). On approval, signed
 * admin_grants row is created. All admins notified by email at each stage.
 * Dependencies: db/connection, uuid, lib/adminGrants, lib/approvalState,
 *               audit.service, notification.service
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { signGrant, verifyGrant } from '../lib/adminGrants';
import { siteOfEmail } from '../lib/approvalState';
import { writeAuditLog } from './audit.service';
import {
  sendAdminPromotionRequestedEmail,
  sendAdminPromotionResultEmail,
} from './notification.service';

export class PromotionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface PromotionRequest {
  id: string;
  target_email: string;
  requested_by: string;
  requested_at: Date;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approver_b: string | null;
  approved_at: Date | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  resolved_at: Date | null;
}

function lower(s: string): string {
  return s.toLowerCase().trim();
}

async function isVerifiedAdmin(email: string): Promise<boolean> {
  const grant = await db('admin_grants')
    .where({ email: lower(email) })
    .first();
  if (!grant) return false;
  return verifyGrant(grant);
}

async function listAllAdmins(): Promise<string[]> {
  const grants = await db('admin_grants');
  return grants.filter(verifyGrant).map((g: any) => g.email as string);
}

export async function createPromotionRequest(
  targetEmailRaw: string,
  requestedBy: string,
  ipAddress?: string,
): Promise<{ id: string }> {
  const targetEmail = lower(targetEmailRaw);
  if (!(await isVerifiedAdmin(requestedBy))) {
    throw new PromotionError('NOT_ADMIN', 'Only admins can request promotions');
  }
  const wl = await db('email_whitelist').where({ email: targetEmail }).first();
  if (!wl) throw new PromotionError('NOT_WHITELISTED', 'Target email is not whitelisted');
  if (wl.locked_at) throw new PromotionError('TARGET_LOCKED', 'Target email is locked');
  if (await isVerifiedAdmin(targetEmail)) {
    throw new PromotionError('ALREADY_ADMIN', 'Target email is already an admin');
  }
  const existingPending = await db('admin_promotion_requests')
    .where({ target_email: targetEmail, status: 'PENDING' })
    .first();
  if (existingPending) {
    throw new PromotionError('ALREADY_PENDING', 'A promotion is already pending for this email');
  }

  const id = uuidv4();
  await db('admin_promotion_requests').insert({
    id,
    target_email: targetEmail,
    requested_by: lower(requestedBy),
    requested_at: new Date(),
    status: 'PENDING',
  });

  await writeAuditLog({
    userEmail: requestedBy,
    resourceType: 'AUTH',
    resourceId: id,
    operation: 'CREATE',
    diffJson: { promotion_action: 'REQUEST', target: targetEmail },
    ipAddress,
  }).catch(() => {});

  // Notify all OTHER admins.
  const allAdmins = await listAllAdmins();
  const recipients = allAdmins.filter((e) => e !== lower(requestedBy));
  if (recipients.length > 0) {
    sendAdminPromotionRequestedEmail(recipients, targetEmail, requestedBy, id).catch(() => {});
  }
  return { id };
}

export async function listPendingPromotions(): Promise<PromotionRequest[]> {
  return db('admin_promotion_requests').where({ status: 'PENDING' }).orderBy('requested_at', 'asc');
}

export async function approvePromotion(
  requestId: string,
  approverEmail: string,
  ipAddress?: string,
): Promise<void> {
  if (!(await isVerifiedAdmin(approverEmail))) {
    throw new PromotionError('NOT_ADMIN', 'Only admins can approve promotions');
  }
  const req = await db('admin_promotion_requests').where({ id: requestId }).first();
  if (!req) throw new PromotionError('NOT_FOUND', 'Promotion request not found');
  if (req.status !== 'PENDING') throw new PromotionError('NOT_PENDING', `Request is ${req.status}`);
  if (lower(req.requested_by) === lower(approverEmail)) {
    throw new PromotionError('SELF_APPROVE', 'You cannot approve your own request');
  }
  const requesterSite = siteOfEmail(req.requested_by);
  const approverSite = siteOfEmail(approverEmail);
  if (!requesterSite || !approverSite || requesterSite === approverSite) {
    throw new PromotionError(
      'SAME_SITE',
      'Approver must be from a different site than the requester',
    );
  }

  const now = new Date();
  // Round to whole seconds (MySQL TIMESTAMP precision; matches signGrant pattern).
  const grantedAt = new Date(Math.floor(now.getTime() / 1000) * 1000);
  const sig = signGrant(req.target_email, grantedAt, req.requested_by, lower(approverEmail));

  await db.transaction(async (trx) => {
    await trx('admin_promotion_requests')
      .where({ id: requestId })
      .update({
        status: 'APPROVED',
        approver_b: lower(approverEmail),
        approved_at: now,
        resolved_at: now,
      });
    await trx('admin_grants')
      .insert({
        email: req.target_email,
        granted_at: grantedAt,
        granted_by_a: req.requested_by,
        granted_by_b: lower(approverEmail),
        signature_hex: sig,
      })
      .onConflict('email')
      .ignore();
  });

  await writeAuditLog({
    userEmail: approverEmail,
    resourceType: 'AUTH',
    resourceId: requestId,
    operation: 'APPROVE',
    diffJson: { promotion_action: 'APPROVE', target: req.target_email },
    ipAddress,
  }).catch(() => {});

  sendAdminPromotionResultEmail(
    [req.requested_by, req.target_email],
    req.target_email,
    'APPROVED',
    null,
  ).catch(() => {});
}

export async function rejectPromotion(
  requestId: string,
  rejectorEmail: string,
  reason: string,
  ipAddress?: string,
): Promise<void> {
  if (!(await isVerifiedAdmin(rejectorEmail))) {
    throw new PromotionError('NOT_ADMIN', 'Only admins can reject promotions');
  }
  const req = await db('admin_promotion_requests').where({ id: requestId }).first();
  if (!req) throw new PromotionError('NOT_FOUND', 'Promotion request not found');
  if (req.status !== 'PENDING') throw new PromotionError('NOT_PENDING', `Request is ${req.status}`);
  const cleanReason = (reason || '').trim();
  if (!cleanReason) throw new PromotionError('REASON_REQUIRED', 'Rejection reason required');

  const now = new Date();
  await db('admin_promotion_requests')
    .where({ id: requestId })
    .update({
      status: 'REJECTED',
      rejected_by: lower(rejectorEmail),
      rejection_reason: cleanReason,
      resolved_at: now,
    });

  await writeAuditLog({
    userEmail: rejectorEmail,
    resourceType: 'AUTH',
    resourceId: requestId,
    operation: 'REJECT',
    diffJson: { promotion_action: 'REJECT', target: req.target_email, reason: cleanReason },
    ipAddress,
  }).catch(() => {});

  sendAdminPromotionResultEmail(
    [req.requested_by, req.target_email],
    req.target_email,
    'REJECTED',
    cleanReason,
  ).catch(() => {});
}

export async function cancelPromotion(
  requestId: string,
  requesterEmail: string,
  ipAddress?: string,
): Promise<void> {
  const req = await db('admin_promotion_requests').where({ id: requestId }).first();
  if (!req) throw new PromotionError('NOT_FOUND', 'Promotion request not found');
  if (req.status !== 'PENDING') throw new PromotionError('NOT_PENDING', `Request is ${req.status}`);
  if (lower(req.requested_by) !== lower(requesterEmail)) {
    throw new PromotionError('NOT_REQUESTER', 'Only the original requester can cancel');
  }

  const now = new Date();
  await db('admin_promotion_requests').where({ id: requestId }).update({
    status: 'CANCELLED',
    resolved_at: now,
  });

  await writeAuditLog({
    userEmail: requesterEmail,
    resourceType: 'AUTH',
    resourceId: requestId,
    operation: 'DELETE',
    diffJson: { promotion_action: 'CANCEL', target: req.target_email },
    ipAddress,
  }).catch(() => {});

  sendAdminPromotionResultEmail([req.target_email], req.target_email, 'CANCELLED', null).catch(
    () => {},
  );
}
