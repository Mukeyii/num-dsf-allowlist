// Purpose: Test seed helpers – insert and clean deterministic test data in the DB
// Dependencies: db/connection (Knex), uuid

import { db } from '../../db/connection';
import { v4 as uuidv4 } from 'uuid';

export const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
export const TEST_INSTANCE_ID = '00000000-0000-0000-0000-000000000010';
export const TEST_ORG_ID = 'test-hospital.de';
export const TEST_EMAIL = 'test@test-hospital.de';
export const TEST_ADMIN_EMAIL = 'admin@imi.uni-muenster.de';

export async function cleanTestData(): Promise<void> {
  await db('audit_logs').del();
  await db('approval_requests').del();
  await db('memberships').del();
  await db('endpoint_ips').del();
  await db('certificates').del();
  await db('endpoints').del();
  await db('contacts').del();
  await db('organizations').del();
  await db('instances').del();
  await db('refresh_tokens').del();
  await db('users').del();
  await db('email_whitelist').del();
}

export async function seedTestUser() {
  await db('email_whitelist').insert({ id: uuidv4(), email: TEST_EMAIL, created_by: 'test', created_at: new Date() }).onConflict('email').ignore();
  await db('users').insert({ id: TEST_USER_ID, email: TEST_EMAIL, totp_enabled: false, created_at: new Date() }).onConflict('email').ignore();
  await db('instances').insert({ id: TEST_INSTANCE_ID, user_id: TEST_USER_ID, label: 'Test Hospital', created_at: new Date() }).onConflict('id').ignore();
  return { userId: TEST_USER_ID, instanceId: TEST_INSTANCE_ID, email: TEST_EMAIL };
}

export async function seedAdminUser() {
  const adminUserId = '00000000-0000-0000-0000-000000000002';
  await db('email_whitelist').insert({ id: uuidv4(), email: TEST_ADMIN_EMAIL, created_by: 'test', created_at: new Date() }).onConflict('email').ignore();
  await db('users').insert({ id: adminUserId, email: TEST_ADMIN_EMAIL, totp_enabled: false, created_at: new Date() }).onConflict('email').ignore();
  return { userId: adminUserId, email: TEST_ADMIN_EMAIL };
}

export async function seedOrganization() {
  await db('organizations').insert({
    identifier: TEST_ORG_ID, instance_id: TEST_INSTANCE_ID, name: 'Test Hospital', active: true,
    email: TEST_EMAIL, address_line: 'Test Street 1', postal_code: '12345', city: 'Teststadt', country_code: 'DE',
    created_at: new Date(), updated_at: new Date(),
  }).onConflict('identifier').ignore();
}

export async function seedContact(overrides?: Record<string, unknown>): Promise<string> {
  const id = uuidv4();
  await db('contacts').insert({
    id, organization_id: TEST_ORG_ID, types: JSON.stringify(['MEDIC']), name: 'Dr. Test',
    email: 'dr.test@test-hospital.de', email_validated: false, phone: '+49123456789',
    created_at: new Date(), updated_at: new Date(), ...overrides,
  });
  return id;
}

export async function seedEndpoint(): Promise<string> {
  const identifier = 'dsf-fhir.test-hospital.de';
  await db('endpoints').insert({
    identifier, organization_id: TEST_ORG_ID, name: 'Test FHIR',
    address: 'https://dsf-fhir.test-hospital.de/fhir', created_at: new Date(), updated_at: new Date(),
  }).onConflict('identifier').ignore();
  await db('endpoint_ips').insert({ id: uuidv4(), endpoint_id: identifier, ip: '10.0.0.1', is_fhir: true, is_bpe: false });
  return identifier;
}
