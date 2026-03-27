/**
 * contacts.service.ts – CRUD for Contacts (1:N per Organization)
 * Contact data is NEVER published in the Allow List.
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { v4 as uuidv4 } from 'uuid';

export async function getContacts(instanceId: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) return [];
  return db('contacts').where({ organization_id: org.identifier }).orderBy('created_at', 'asc');
}

export async function createContact(
  instanceId: string,
  data: { types: string[]; name?: string; email: string; phone?: string; addressLine?: string; city?: string; postalCode?: string; countryCode?: string; },
  userEmail: string, ipAddress: string
) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  if (!data.types?.length) throw new Error('TYPES_REQUIRED');
  const validTypes = ['MEDIC', 'DSF_ADMIN', 'SECURITY'];
  if (!data.types.every(t => validTypes.includes(t))) throw new Error('INVALID_TYPE');

  const id = uuidv4();
  const now = new Date();
  await db('contacts').insert({
    id, organization_id: org.identifier, types: JSON.stringify(data.types),
    name: data.name ?? null, email: data.email, email_validated: 0,
    phone: data.phone ?? null, address_line: data.addressLine ?? null,
    city: data.city ?? null, postal_code: data.postalCode ?? null,
    country_code: data.countryCode ?? null, created_at: now, updated_at: now,
  });
  await writeAuditLog({ userEmail, instanceId, resourceType: 'CONTACT', resourceId: id, operation: 'CREATE', diffJson: { after: { ...data, email: '[REDACTED]' } }, ipAddress });
  return db('contacts').where({ id }).first();
}

export async function updateContact(
  instanceId: string, contactId: string,
  data: Partial<{ types: string[]; name: string; email: string; phone: string; addressLine: string; city: string; postalCode: string; countryCode: string; }>,
  userEmail: string, ipAddress: string
) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const contact = await db('contacts').where({ id: contactId, organization_id: org.identifier }).first();
  if (!contact) throw new Error('CONTACT_NOT_FOUND');

  const updates: Record<string, any> = { updated_at: new Date() };
  if (data.types) updates.types = JSON.stringify(data.types);
  if (data.name !== undefined) updates.name = data.name;
  if (data.email) updates.email = data.email;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.addressLine !== undefined) updates.address_line = data.addressLine;
  if (data.city !== undefined) updates.city = data.city;
  if (data.postalCode !== undefined) updates.postal_code = data.postalCode;
  if (data.countryCode !== undefined) updates.country_code = data.countryCode;

  await db('contacts').where({ id: contactId }).update(updates);
  await writeAuditLog({ userEmail, instanceId, resourceType: 'CONTACT', resourceId: contactId, operation: 'UPDATE', diffJson: { after: { ...data, email: data.email ? '[REDACTED]' : undefined } }, ipAddress });
  return db('contacts').where({ id: contactId }).first();
}

export async function deleteContact(instanceId: string, contactId: string, userEmail: string, ipAddress: string) {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const contact = await db('contacts').where({ id: contactId, organization_id: org.identifier }).first();
  if (!contact) throw new Error('CONTACT_NOT_FOUND');
  await db('contacts').where({ id: contactId }).delete();
  await writeAuditLog({ userEmail, instanceId, resourceType: 'CONTACT', resourceId: contactId, operation: 'DELETE', ipAddress });
}

export async function resendVerification(
  instanceId: string,
  contactId: string,
  userEmail: string,
  ipAddress: string
): Promise<void> {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const contact = await db('contacts').where({ id: contactId, organization_id: org.identifier }).first();
  if (!contact) throw new Error('CONTACT_NOT_FOUND');
  if (contact.email_validated) throw new Error('ALREADY_VALIDATED');

  // In production, this would send a real verification email.
  // For now, log the action.
  await writeAuditLog({
    userEmail, instanceId, resourceType: 'CONTACT',
    resourceId: contactId, operation: 'UPDATE', ipAddress,
  });
}
