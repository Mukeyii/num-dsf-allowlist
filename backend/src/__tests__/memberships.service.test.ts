/**
 * memberships.service.test.ts – DB-backed CRUD test for memberships.service.
 * Exercises getMemberships/createMembership/updateMembership/deleteMembership.
 * createMembership requires an existing endpoint on the org; delete is a soft
 * delete (deleted_at) and must drop the row out of getMemberships.
 * Dependencies: db/connection, memberships.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import {
  getMemberships,
  createMembership,
  updateMembership,
  deleteMembership,
} from '../services/memberships.service';

describe('memberships.service', () => {
  const org = `svc-memberships-${Date.now()}-${uuidv4().slice(0, 8)}.example.de`;
  const instanceId = uuidv4();
  const userId = uuidv4();
  const endpointId = `ep-${Date.now()}-${uuidv4().slice(0, 8)}.example.de`;
  const email = 'caller@example.de';

  beforeAll(async () => {
    await db('users').insert({ id: userId, email: `${userId}@x.de`, totp_enabled: false, created_at: new Date() });
    await db('instances').insert({ id: instanceId, user_id: userId, label: 'svc', created_at: new Date() });
    await db('organizations').insert({
      identifier: org, instance_id: instanceId, name: 'Svc', active: 1,
      email: 'x@x.de', address_line: 'x', postal_code: '0', city: 'x',
      country_code: 'DE', created_at: new Date(), updated_at: new Date(),
    });
    await db('endpoints').insert({
      identifier: endpointId, organization_id: org, name: 'EP',
      address: 'https://ep.example.de/fhir', created_at: new Date(), updated_at: new Date(),
    });
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

  it('creates, lists, updates and soft-deletes a membership', async () => {
    const created = await createMembership(
      instanceId,
      { parentOrganization: 'parent.example.de', endpointId, roles: ['DIC'] },
      email, '127.0.0.1',
    );
    const membershipId = created!.id as string;

    const listed = await getMemberships(instanceId);
    expect(listed.some((m: any) => m.id === membershipId)).toBe(true);

    const updated = await updateMembership(instanceId, membershipId, { roles: ['DIC', 'HRP'] }, email, '127.0.0.1');
    const roles = typeof updated!.roles === 'string' ? JSON.parse(updated!.roles) : updated!.roles;
    expect(roles).toEqual(['DIC', 'HRP']);

    await deleteMembership(instanceId, membershipId, email, '127.0.0.1');
    const after = await getMemberships(instanceId);
    expect(after.some((m: any) => m.id === membershipId)).toBe(false);
  });
});
