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
  const deletedMembershipId = uuidv4();
  const approvalId = uuidv4();

  beforeAll(async () => {
    await db('users').insert({
      id: userId,
      email: `${userId}@x.de`,
      totp_enabled: false,
      created_at: new Date(),
    });
    await db('instances').insert({
      id: instanceId,
      user_id: userId,
      label: 'svc',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: org,
      instance_id: instanceId,
      name: 'Net Org',
      active: 1,
      email: 'o@x.de',
      address_line: 'x',
      postal_code: '0',
      city: 'Muenster',
      country_code: 'DE',
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('endpoints').insert({
      identifier: endpointId,
      organization_id: org,
      name: 'EP',
      address: 'https://ep.example.de/fhir',
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('memberships').insert({
      id: membershipId,
      organization_id: org,
      parent_organization: 'parent.example.de',
      endpoint_id: endpointId,
      roles: JSON.stringify(['DIC']),
      created_at: new Date(),
      updated_at: new Date(),
    });
    // Soft-deleted (admin-removed) affiliation — must NOT render on the map.
    await db('memberships').insert({
      id: deletedMembershipId,
      organization_id: org,
      parent_organization: 'removed-parent.example.de',
      endpoint_id: endpointId,
      roles: JSON.stringify(['HRP']),
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: new Date(),
    });
    await db('approval_requests').insert({
      id: approvalId,
      instance_id: instanceId,
      status: 'APPROVED',
      created_at: new Date(),
      submitted_at: new Date(),
      resolved_at: new Date(),
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
    expect(found.memberships.some((m: any) => m.parent_organization === 'parent.example.de')).toBe(
      true,
    );
    // Soft-deleted affiliations are absent from the map.
    expect(
      found.memberships.some((m: any) => m.parent_organization === 'removed-parent.example.de'),
    ).toBe(false);
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

describe('network.service – federation set matches the bundle rule', () => {
  // Org A: latest approval is REJECTED (an older one was APPROVED) → excluded.
  const rejectedOrg = `svc-network-rej-${Date.now()}-${uuidv4().slice(0, 8)}.example.de`;
  const rejectedInstance = uuidv4();
  // Org B: latest approval is APPROVED but active=0 → excluded.
  const inactiveOrg = `svc-network-inact-${Date.now()}-${uuidv4().slice(0, 8)}.example.de`;
  const inactiveInstance = uuidv4();
  const userId = uuidv4();

  beforeAll(async () => {
    await db('users').insert({
      id: userId,
      email: `${userId}@x.de`,
      totp_enabled: false,
      created_at: new Date(),
    });
    await db('instances').insert([
      { id: rejectedInstance, user_id: userId, label: 'rej', created_at: new Date() },
      { id: inactiveInstance, user_id: userId, label: 'inact', created_at: new Date() },
    ]);
    await db('organizations').insert([
      {
        identifier: rejectedOrg,
        instance_id: rejectedInstance,
        name: 'Rejected Org',
        active: 1,
        email: 'r@x.de',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        identifier: inactiveOrg,
        instance_id: inactiveInstance,
        name: 'Inactive Org',
        active: 0,
        email: 'i@x.de',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    // Rejected org: older APPROVED superseded by a newer REJECTED.
    await db('approval_requests').insert([
      {
        id: uuidv4(),
        instance_id: rejectedInstance,
        status: 'APPROVED',
        created_at: new Date(Date.now() - 7 * 86400000),
        submitted_at: new Date(Date.now() - 7 * 86400000),
        resolved_at: new Date(Date.now() - 6 * 86400000),
      },
      {
        id: uuidv4(),
        instance_id: rejectedInstance,
        status: 'REJECTED',
        created_at: new Date(Date.now() - 1 * 86400000),
        submitted_at: new Date(Date.now() - 1 * 86400000),
        resolved_at: new Date(Date.now() - 1 * 86400000),
      },
    ]);
    // Inactive org: latest approval APPROVED, but org.active = 0.
    await db('approval_requests').insert({
      id: uuidv4(),
      instance_id: inactiveInstance,
      status: 'APPROVED',
      created_at: new Date(),
      submitted_at: new Date(),
      resolved_at: new Date(),
    });
  });

  afterAll(async () => {
    await db('approval_requests')
      .whereIn('instance_id', [rejectedInstance, inactiveInstance])
      .del();
    await db('organizations').whereIn('identifier', [rejectedOrg, inactiveOrg]).del();
    await db('instances').whereIn('id', [rejectedInstance, inactiveInstance]).del();
    await db('users').where({ id: userId }).del();
  });

  it('excludes an org whose latest approval is REJECTED (older APPROVED ignored)', async () => {
    const { organizations } = await getNetworkMap({ isAdmin: true });
    expect(organizations.some((o: any) => o.identifier === rejectedOrg)).toBe(false);
  });

  it('excludes an inactive org even if its latest approval is APPROVED', async () => {
    const { organizations } = await getNetworkMap({ isAdmin: true });
    expect(organizations.some((o: any) => o.identifier === inactiveOrg)).toBe(false);
  });
});
