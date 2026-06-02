/**
 * organization.service.test.ts – DB-backed test for organization.service.
 * Exercises getOrganization (empty + after create) and the upsertOrganization
 * insert and update branches. The instance owns at most one org.
 * Dependencies: db/connection, organization.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { getOrganization, upsertOrganization } from '../services/organization.service';

describe('organization.service', () => {
  const org = `svc-org-${Date.now()}-${uuidv4().slice(0, 8)}.example.de`;
  const instanceId = uuidv4();
  const userId = uuidv4();
  const email = 'caller@example.de';

  beforeAll(async () => {
    await db('users').insert({ id: userId, email: `${userId}@x.de`, totp_enabled: false, created_at: new Date() });
    await db('instances').insert({ id: instanceId, user_id: userId, label: 'svc', created_at: new Date() });
  });

  afterAll(async () => {
    try {
      await db('organizations').where({ instance_id: instanceId }).del();
    } finally {
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });

  it('returns null when no org exists, then inserts then updates', async () => {
    expect(await getOrganization(instanceId)).toBeFalsy();

    const created = await upsertOrganization(
      instanceId,
      { identifier: org, name: 'Initial', active: true, email: 'o@x.de', city: 'Muenster', countryCode: 'DE' },
      email, '127.0.0.1',
    );
    expect(created!.identifier).toBe(org);
    expect(created!.name).toBe('Initial');

    const updated = await upsertOrganization(
      instanceId,
      { identifier: org, name: 'Renamed', active: false, email: 'o@x.de' },
      email, '127.0.0.1',
    );
    expect(updated!.name).toBe('Renamed');
    expect(!!updated!.active).toBe(false);

    const fetched = await getOrganization(instanceId);
    expect(fetched!.name).toBe('Renamed');
  });

  it('rejects an identifier change on an existing org', async () => {
    await expect(
      upsertOrganization(
        instanceId,
        { identifier: `other-${org}`, name: 'Renamed', active: true, email: 'o@x.de' },
        email, '127.0.0.1',
      ),
    ).rejects.toThrow('IDENTIFIER_IMMUTABLE');
  });
});
