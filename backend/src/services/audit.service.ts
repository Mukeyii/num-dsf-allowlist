/**
 * audit.service.ts – Append-only audit log writes
 * Dependencies: db/connection, uuid
 *
 * Important: Logging failures must NEVER block the actual operation.
 * Always wrap in try-catch. Never log PEM, passwords, or OTP codes.
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

type ResourceType = 'ORGANIZATION' | 'CONTACT' | 'ENDPOINT' | 'CERTIFICATE' | 'MEMBERSHIP' | 'AUTH' | 'APPROVAL' | 'MARKETPLACE';
type Operation = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT' | 'OTP_REQUEST' | 'OTP_VERIFY' | 'TOTP_SETUP' | 'TOTP_VERIFY' | 'FAILED_LOGIN';

interface AuditEntry {
  userEmail?: string;
  instanceId?: string;
  resourceType: ResourceType;
  resourceId?: string;
  operation: Operation;
  diffJson?: object;
  ipAddress?: string;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await db('audit_logs').insert({
      id: uuidv4(),
      timestamp: new Date(),
      user_email: entry.userEmail,
      instance_id: entry.instanceId,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      operation: entry.operation,
      diff_json: entry.diffJson ? JSON.stringify(entry.diffJson) : null,
      ip_address: entry.ipAddress,
    });
  } catch (err) {
    // Logging failure must never propagate
    console.error('[AuditLog] Failed to write entry:', err);
  }
}
