/**
 * organization.service.ts – CRUD for Organization (1:1 per instance)
 * Deletion only via Request-for-Removal → Approval workflow
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';

/**
 * Fetch the single organization belonging to an instance.
 * @param instanceId Instance to look up.
 * @returns The organization row, or null if none exists.
 */
export async function getOrganization(instanceId: string) {
  return db('organizations').where({ instance_id: instanceId }).first() ?? null;
}

/**
 * Create or update the instance's organization and write a CREATE/UPDATE audit log (email omitted from the diff).
 * On update, throws IDENTIFIER_IMMUTABLE if data.identifier differs from the existing FQDN identifier.
 * @param data Organization fields; identifier is the cross-tool primary key and cannot change after creation.
 * @returns The resulting organization row.
 */
export async function upsertOrganization(
  instanceId: string,
  data: {
    identifier: string;
    name: string;
    active: boolean;
    email: string;
    addressLine?: string;
    postalCode?: string;
    city?: string;
    countryCode?: string;
    clientCertThumbprint?: string;
  },
  userEmail: string,
  ipAddress: string,
) {
  const existing = await getOrganization(instanceId);
  const now = new Date();

  if (existing) {
    // Federation-critical: identifier is the cross-tool primary key. Other
    // AllowList tools that already received this org pin the old FQDN; a
    // silent rename here would desync the federation. The DB-level trigger
    // (migration 015) is the last line — this guard surfaces a clean
    // IDENTIFIER_IMMUTABLE error to the API client instead of a raw MySQL
    // error.
    if (data.identifier && data.identifier !== existing.identifier) {
      throw new Error('IDENTIFIER_IMMUTABLE');
    }
    const before = { ...existing };
    await db('organizations')
      .where({ instance_id: instanceId })
      .update({
        name: data.name,
        active: data.active,
        email: data.email,
        address_line: data.addressLine ?? null,
        postal_code: data.postalCode ?? null,
        city: data.city ?? null,
        country_code: data.countryCode ?? null,
        client_cert_thumbprint: data.clientCertThumbprint || null,
        updated_at: now,
      });
    const { email: _e1, ...beforeSafe } = before || {};
    const { email: _e2, ...afterSafe } = data || {};
    await writeAuditLog({
      userEmail,
      instanceId,
      resourceType: 'ORGANIZATION',
      resourceId: existing.identifier,
      operation: 'UPDATE',
      diffJson: { before: beforeSafe, after: afterSafe },
      ipAddress,
    });
    return getOrganization(instanceId);
  } else {
    await db('organizations').insert({
      identifier: data.identifier,
      instance_id: instanceId,
      name: data.name,
      active: data.active ? 1 : 0,
      email: data.email,
      address_line: data.addressLine ?? null,
      postal_code: data.postalCode ?? null,
      city: data.city ?? null,
      country_code: data.countryCode ?? null,
      client_cert_thumbprint: data.clientCertThumbprint || null,
      created_at: now,
      updated_at: now,
    });
    const { email: _e3, ...createSafe } = data || {};
    await writeAuditLog({
      userEmail,
      instanceId,
      resourceType: 'ORGANIZATION',
      resourceId: data.identifier,
      operation: 'CREATE',
      diffJson: { after: createSafe },
      ipAddress,
    });
    return getOrganization(instanceId);
  }
}
