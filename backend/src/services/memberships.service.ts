/**
 * memberships.service.ts – CRUD for Memberships
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { v4 as uuidv4 } from 'uuid';

const VALID_ROLES = ['DIC', 'HRP', 'DMS', 'AMS'];

/**
 * List the organization's active (non-soft-deleted) memberships, ordered by creation time.
 * @param instanceId Instance whose organization owns the memberships.
 * @returns Array of membership rows; empty if the instance has no organization.
 */
export async function getMemberships(instanceId: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) return [];
  return db('memberships').where({ organization_id: org.identifier }).whereNull('deleted_at').orderBy('created_at', 'asc');
}

/**
 * Create a membership and write a CREATE audit log. If a soft-deleted row with the same
 * (org, parentOrganization, endpoint) identity exists, it is resurrected instead of duplicated.
 * Throws ORGANIZATION_NOT_FOUND if no org, INVALID_ROLES if roles empty/not in DIC/HRP/DMS/AMS,
 * ENDPOINT_NOT_FOUND if the referenced endpoint isn't in this org.
 * @returns The created or resurrected membership row.
 */
export async function createMembership(instanceId: string, data: { parentOrganization: string; endpointId: string; roles: string[] }, userEmail: string, ipAddress: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  if (!data.roles?.length || !data.roles.every(r => VALID_ROLES.includes(r))) throw new Error('INVALID_ROLES');
  const endpoint = await db('endpoints').where({ identifier: data.endpointId, organization_id: org.identifier }).first();
  if (!endpoint) throw new Error('ENDPOINT_NOT_FOUND');
  // Resurrect a soft-deleted row with the same logical identity instead of inserting a duplicate.
  const existing = await db('memberships')
    .where({ organization_id: org.identifier, parent_organization: data.parentOrganization, endpoint_id: data.endpointId })
    .whereNotNull('deleted_at')
    .first();
  if (existing) {
    await db('memberships').where({ id: existing.id }).update({
      deleted_at: null,
      roles: JSON.stringify(data.roles),
      updated_at: new Date(),
    });
    await writeAuditLog({ userEmail, instanceId, resourceType: 'MEMBERSHIP', resourceId: existing.id, operation: 'CREATE', diffJson: { after: data }, ipAddress });
    return db('memberships').where({ id: existing.id }).first();
  }
  const id = uuidv4();
  const now = new Date();
  await db('memberships').insert({ id, organization_id: org.identifier, parent_organization: data.parentOrganization, endpoint_id: data.endpointId, roles: JSON.stringify(data.roles), created_at: now, updated_at: now });
  await writeAuditLog({ userEmail, instanceId, resourceType: 'MEMBERSHIP', resourceId: id, operation: 'CREATE', diffJson: { after: data }, ipAddress });
  return db('memberships').where({ id }).first();
}

/**
 * Update provided fields of an active membership and write an UPDATE audit log.
 * Throws ORGANIZATION_NOT_FOUND if no org, MEMBERSHIP_NOT_FOUND if not an active row in this org,
 * INVALID_ROLES if roles are supplied but not all in DIC/HRP/DMS/AMS.
 * @returns The updated membership row.
 */
export async function updateMembership(instanceId: string, membershipId: string, data: { parentOrganization?: string; endpointId?: string; roles?: string[] }, userEmail: string, ipAddress: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const membership = await db('memberships').where({ id: membershipId, organization_id: org.identifier }).whereNull('deleted_at').first();
  if (!membership) throw new Error('MEMBERSHIP_NOT_FOUND');
  if (data.roles && !data.roles.every(r => VALID_ROLES.includes(r))) throw new Error('INVALID_ROLES');
  const updates: Record<string, any> = { updated_at: new Date() };
  if (data.parentOrganization) updates.parent_organization = data.parentOrganization;
  if (data.endpointId) updates.endpoint_id = data.endpointId;
  if (data.roles) updates.roles = JSON.stringify(data.roles);
  await db('memberships').where({ id: membershipId }).update(updates);
  await writeAuditLog({ userEmail, instanceId, resourceType: 'MEMBERSHIP', resourceId: membershipId, operation: 'UPDATE', diffJson: { after: data }, ipAddress });
  return db('memberships').where({ id: membershipId }).first();
}

/**
 * Soft-delete a membership (sets deleted_at) and write a DELETE audit log.
 * Throws ORGANIZATION_NOT_FOUND if no org, MEMBERSHIP_NOT_FOUND if not an active row in this org.
 */
export async function deleteMembership(instanceId: string, membershipId: string, userEmail: string, ipAddress: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const membership = await db('memberships').where({ id: membershipId, organization_id: org.identifier }).whereNull('deleted_at').first();
  if (!membership) throw new Error('MEMBERSHIP_NOT_FOUND');
  await db('memberships').where({ id: membershipId }).update({ deleted_at: new Date() });
  await writeAuditLog({ userEmail, instanceId, resourceType: 'MEMBERSHIP', resourceId: membershipId, operation: 'DELETE', ipAddress });
}
