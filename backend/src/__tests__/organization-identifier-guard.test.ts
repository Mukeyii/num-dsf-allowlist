/**
 * organization-identifier-guard.test.ts
 * The application-layer guard in upsertOrganization must reject any
 * caller that tries to change the organization identifier of an
 * existing organization with a clean IDENTIFIER_IMMUTABLE error
 * (instead of letting the DB trigger surface a raw MySQL error).
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { upsertOrganization } from '../services/organization.service';

const userEmail = `orgguard-${Date.now()}@example.de`;
const userId = uuidv4();
const instanceId = uuidv4();
const orgIdentifier = `orgguard-${Date.now()}.example.de`;

describe('organization identifier-guard (service layer)', () => {
  beforeAll(async () => {
    await db('users').insert({ id: userId, email: userEmail, totp_enabled: false, created_at: new Date() });
    await db('instances').insert({ id: instanceId, user_id: userId, label: 'orgguard-test', created_at: new Date() });
    await upsertOrganization(
      instanceId,
      {
        identifier: orgIdentifier, name: 'Guard Org', active: true, email: `admin@${orgIdentifier}`,
        addressLine: '', postalCode: '', city: '', countryCode: '',
      },
      userEmail, '0.0.0.0',
    );
  });

  afterAll(async () => {
    await db('organizations').where({ identifier: orgIdentifier }).del();
    await db('instances').where({ id: instanceId }).del();
    await db('users').where({ id: userId }).del();
  });

  it('throws IDENTIFIER_IMMUTABLE when a rename is attempted', async () => {
    await expect(
      upsertOrganization(
        instanceId,
        {
          identifier: 'renamed.example.de', name: 'Guard Org', active: true, email: `admin@${orgIdentifier}`,
          addressLine: '', postalCode: '', city: '', countryCode: '',
        },
        userEmail, '0.0.0.0',
      ),
    ).rejects.toThrow('IDENTIFIER_IMMUTABLE');
  });

  it('allows a no-op upsert with the same identifier', async () => {
    await expect(
      upsertOrganization(
        instanceId,
        {
          identifier: orgIdentifier, name: 'Renamed-Display-Only', active: true, email: `admin@${orgIdentifier}`,
          addressLine: '', postalCode: '', city: '', countryCode: '',
        },
        userEmail, '0.0.0.0',
      ),
    ).resolves.toBeDefined();
    const row = await db('organizations').where({ identifier: orgIdentifier }).first();
    expect(row.name).toBe('Renamed-Display-Only');
  });
});
