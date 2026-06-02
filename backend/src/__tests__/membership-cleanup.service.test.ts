/**
 * membership-cleanup.service.test.ts – DB-backed test for runMembershipCleanup.
 * Hard-deletes memberships whose deleted_at is older than the 90-day retention
 * window; rows soft-deleted within the window must survive. Seeds a unique org +
 * endpoint and two memberships (one 200 days old, one 1 day old).
 * Dependencies: db/connection, membership-cleanup.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { runMembershipCleanup } from '../services/membership-cleanup.service';

describe('membership-cleanup.service – runMembershipCleanup', () => {
  const org = `svc-mcleanup-${Date.now()}-${uuidv4().slice(0, 8)}.example.de`;
  const instanceId = uuidv4();
  const userId = uuidv4();
  const endpointId = `ep-mcleanup-${Date.now()}-${uuidv4().slice(0, 8)}.example.de`;
  const oldId = uuidv4();
  const recentId = uuidv4();

  const day = 86400_000;
  const oldDeletedAt = new Date(Date.now() - 200 * day);
  const recentDeletedAt = new Date(Date.now() - 1 * day);

  beforeAll(async () => {
    await db('users').insert({ id: userId, email: `${userId}@x.de`, totp_enabled: false, created_at: new Date() });
    await db('instances').insert({ id: instanceId, user_id: userId, label: 'mcleanup', created_at: new Date() });
    await db('organizations').insert({
      identifier: org, instance_id: instanceId, name: 'MCleanup', active: 1,
      email: 'x@x.de', address_line: 'x', postal_code: '0', city: 'x',
      country_code: 'DE', created_at: new Date(), updated_at: new Date(),
    });
    await db('endpoints').insert({
      identifier: endpointId, organization_id: org, name: 'EP',
      address: 'https://ep.example.de/fhir', created_at: new Date(), updated_at: new Date(),
    });
    await db('memberships').insert([
      {
        id: oldId, organization_id: org, parent_organization: 'parent.example.de',
        endpoint_id: endpointId, roles: JSON.stringify(['DIC']),
        created_at: new Date(), updated_at: new Date(), deleted_at: oldDeletedAt,
      },
      {
        id: recentId, organization_id: org, parent_organization: 'parent.example.de',
        endpoint_id: endpointId, roles: JSON.stringify(['HRP']),
        created_at: new Date(), updated_at: new Date(), deleted_at: recentDeletedAt,
      },
    ]);
  });

  afterAll(async () => {
    try {
      await db('memberships').where({ organization_id: org }).del();
      await db('endpoints').where({ organization_id: org }).del();
    } finally {
      await db('organizations').where({ identifier: org }).del();
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });

  it('hard-deletes rows past the retention window and keeps recent ones', async () => {
    const deleted = await runMembershipCleanup();
    expect(deleted).toBeGreaterThanOrEqual(1);

    const oldRow = await db('memberships').where({ id: oldId }).first();
    expect(oldRow).toBeUndefined();

    const recentRow = await db('memberships').where({ id: recentId }).first();
    expect(recentRow).toBeDefined();
  });
});
