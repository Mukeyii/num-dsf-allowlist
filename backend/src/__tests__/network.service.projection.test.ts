/**
 * network.service.projection.test.ts – Extends network.service.test.ts.
 * Focuses on the isAdmin projection difference (admin sees endpoint addresses,
 * IPs and contacts; non-admin sees none of those), and that a DRAFT (never
 * approved) org plus a soft-deleted membership are excluded from the map.
 * Uses its own unique graph; does not duplicate the base suite's assertions.
 * Dependencies: db/connection, network.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { getNetworkMap } from '../services/network.service';

const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;

describe('network.service – admin vs non-admin projection of an approved org', () => {
  const userId = uuidv4();
  const instanceId = uuidv4();
  const org = `svc-net-proj-${suffix}.example.de`;
  const endpointId = `ep-net-proj-${suffix}.example.de`;
  const endpointAddress = `https://${endpointId}/fhir`;
  const fhirIp = '10.20.30.40';
  const liveMembershipId = uuidv4();
  const deletedMembershipId = uuidv4();
  const contactEmail = `contact-${suffix}@example.de`;
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
      label: 'net-proj',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: org,
      instance_id: instanceId,
      name: 'Proj Org',
      active: 1,
      email: 'proj-org@example.de',
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
      name: 'Proj EP',
      address: endpointAddress,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('endpoint_ips').insert({
      id: uuidv4(),
      endpoint_id: endpointId,
      ip: fhirIp,
      is_fhir: 1,
      is_bpe: 0,
    });
    await db('contacts').insert({
      id: uuidv4(),
      organization_id: org,
      types: JSON.stringify(['DSF_ADMIN']),
      name: 'Proj Contact',
      email: contactEmail,
      phone: '+49 251 0000',
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('memberships').insert([
      {
        id: liveMembershipId,
        organization_id: org,
        parent_organization: 'live-parent.example.de',
        endpoint_id: endpointId,
        roles: JSON.stringify(['DIC']),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: deletedMembershipId,
        organization_id: org,
        parent_organization: 'soft-deleted-parent.example.de',
        endpoint_id: endpointId,
        roles: JSON.stringify(['HRP']),
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: new Date(),
      },
    ]);
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
      await db('contacts').where({ organization_id: org }).del();
      await db('memberships').where({ organization_id: org }).del();
      await db('endpoint_ips').where({ endpoint_id: endpointId }).del();
      await db('endpoints').where({ organization_id: org }).del();
    } finally {
      await db('organizations').where({ identifier: org }).del();
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });

  it('non-admin endpoints carry only identifier+name — no address or IPs', async () => {
    const { organizations } = await getNetworkMap({ isAdmin: false });
    const found = organizations.find((o) => o.identifier === org);
    expect(found).toBeTruthy();

    const ep = (found!.endpoints as Array<Record<string, unknown>>).find(
      (e) => e.identifier === endpointId,
    );
    expect(ep).toBeTruthy();
    expect(ep!.name).toBe('Proj EP');
    expect(ep!.address).toBeUndefined();
    expect(ep!.ips).toBeUndefined();
  });

  it('non-admin org omits contacts, email and the admin-only cert detail fields', async () => {
    const { organizations } = await getNetworkMap({ isAdmin: false });
    const found = organizations.find((o) => o.identifier === org) as Record<string, unknown>;
    expect(found.contacts).toBeUndefined();
    expect(found.email).toBeUndefined();
    expect(found.next_cert_expiry).toBeUndefined();
    expect(found.certificates_count).toBeUndefined();
  });

  it('non-admin memberships carry parent+roles but never the endpoint_id FK', async () => {
    const { organizations } = await getNetworkMap({ isAdmin: false });
    const found = organizations.find((o) => o.identifier === org);
    const live = (found!.memberships as Array<Record<string, unknown>>).find(
      (m) => m.parent_organization === 'live-parent.example.de',
    );
    expect(live).toBeTruthy();
    expect(live!.roles).toEqual(['DIC']);
    expect(live!.endpoint_id).toBeUndefined();
  });

  it('admin endpoints expose the FHIR address and the seeded IP', async () => {
    const { organizations } = await getNetworkMap({ isAdmin: true });
    const found = organizations.find((o) => o.identifier === org);
    const ep = (found!.endpoints as Array<Record<string, unknown>>).find(
      (e) => e.identifier === endpointId,
    );
    expect(ep!.address).toBe(endpointAddress);
    const ips = ep!.ips as Array<Record<string, unknown>>;
    expect(ips.some((i) => i.ip === fhirIp && i.is_fhir === true)).toBe(true);
  });

  it('admin org exposes contact PII and the org email', async () => {
    const { organizations } = await getNetworkMap({ isAdmin: true });
    const found = organizations.find((o) => o.identifier === org) as Record<string, unknown>;
    expect(found.email).toBe('proj-org@example.de');
    const contacts = found.contacts as Array<Record<string, unknown>>;
    expect(contacts.some((c) => c.email === contactEmail && c.name === 'Proj Contact')).toBe(true);
  });

  it('soft-deleted memberships are excluded for both admin and non-admin views', async () => {
    for (const isAdmin of [true, false]) {
      const { organizations } = await getNetworkMap({ isAdmin });
      const found = organizations.find((o) => o.identifier === org);
      const memberships = found!.memberships as Array<Record<string, unknown>>;
      expect(
        memberships.some((m) => m.parent_organization === 'soft-deleted-parent.example.de'),
      ).toBe(false);
      expect(memberships.some((m) => m.parent_organization === 'live-parent.example.de')).toBe(
        true,
      );
    }
  });
});

describe('network.service – a DRAFT org with no approval decision is excluded', () => {
  const userId = uuidv4();
  const draftInstance = uuidv4();
  const draftOrg = `svc-net-draft-${suffix}.example.de`;
  const draftApprovalId = uuidv4();

  beforeAll(async () => {
    await db('users').insert({
      id: userId,
      email: `${userId}@x.de`,
      totp_enabled: false,
      created_at: new Date(),
    });
    await db('instances').insert({
      id: draftInstance,
      user_id: userId,
      label: 'net-draft',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: draftOrg,
      instance_id: draftInstance,
      name: 'Draft Org',
      active: 1,
      email: 'draft@example.de',
      created_at: new Date(),
      updated_at: new Date(),
    });
    // Latest (and only) approval row is DRAFT — never approved.
    await db('approval_requests').insert({
      id: draftApprovalId,
      instance_id: draftInstance,
      status: 'DRAFT',
      created_at: new Date(),
    });
  });

  afterAll(async () => {
    await db('approval_requests').where({ id: draftApprovalId }).del();
    await db('organizations').where({ identifier: draftOrg }).del();
    await db('instances').where({ id: draftInstance }).del();
    await db('users').where({ id: userId }).del();
  });

  it('a still-DRAFT org never enters the federation set', async () => {
    const { organizations } = await getNetworkMap({ isAdmin: true });
    expect(organizations.some((o) => o.identifier === draftOrg)).toBe(false);
  });
});
