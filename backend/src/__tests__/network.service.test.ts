/**
 * network.service.test.ts – DB-backed test for network.service.getNetworkMap.
 * Seeds an APPROVED instance/org with an endpoint + membership and asserts the
 * aggregated map includes it, with admin-only fields gated by opts.isAdmin.
 * Dependencies: db/connection, network.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { getNetworkMap } from '../services/network.service';

describe('network.service', () => {
  const org = `svc-network-${Date.now()}-${uuidv4().slice(0, 8)}.example.de`;
  const instanceId = uuidv4();
  const userId = uuidv4();
  const endpointId = `ep-${Date.now()}-${uuidv4().slice(0, 8)}.example.de`;
  const membershipId = uuidv4();
  const approvalId = uuidv4();

  beforeAll(async () => {
    await db('users').insert({ id: userId, email: `${userId}@x.de`, totp_enabled: false, created_at: new Date() });
    await db('instances').insert({ id: instanceId, user_id: userId, label: 'svc', created_at: new Date() });
    await db('organizations').insert({
      identifier: org, instance_id: instanceId, name: 'Net Org', active: 1,
      email: 'o@x.de', address_line: 'x', postal_code: '0', city: 'Muenster',
      country_code: 'DE', created_at: new Date(), updated_at: new Date(),
    });
    await db('endpoints').insert({
      identifier: endpointId, organization_id: org, name: 'EP',
      address: 'https://ep.example.de/fhir', created_at: new Date(), updated_at: new Date(),
    });
    await db('memberships').insert({
      id: membershipId, organization_id: org, parent_organization: 'parent.example.de',
      endpoint_id: endpointId, roles: JSON.stringify(['DIC']),
      created_at: new Date(), updated_at: new Date(),
    });
    await db('approval_requests').insert({
      id: approvalId, instance_id: instanceId, status: 'APPROVED',
      created_at: new Date(), submitted_at: new Date(), resolved_at: new Date(),
    });
  });

  afterAll(async () => {
    try {
      await db('approval_requests').where({ id: approvalId }).del();
      await db('memberships').where({ organization_id: org }).del();
      await db('endpoints').where({ organization_id: org }).del();
    } finally {
      await db('organizations').where({ identifier: org }).del();
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });

  it('includes an approved org with its membership (non-admin view, no PII)', async () => {
    const { organizations } = await getNetworkMap({ isAdmin: false });
    const found = organizations.find((o: any) => o.identifier === org) as any;
    expect(found).toBeTruthy();
    expect(found.name).toBe('Net Org');
    expect(found.endpoints.some((e: any) => e.identifier === endpointId)).toBe(true);
    expect(found.memberships.some((m: any) => m.parent_organization === 'parent.example.de')).toBe(true);
    // Non-admins get no contact PII or email.
    expect(found.email).toBeUndefined();
    expect(found.contacts).toBeUndefined();
  });

  it('exposes admin-only fields when isAdmin is true', async () => {
    const { organizations } = await getNetworkMap({ isAdmin: true });
    const found = organizations.find((o: any) => o.identifier === org) as any;
    expect(found).toBeTruthy();
    expect(found.email).toBe('o@x.de');
    expect(Array.isArray(found.contacts)).toBe(true);
    expect(found.memberships.some((m: any) => m.endpoint_id === endpointId)).toBe(true);
  });
});
