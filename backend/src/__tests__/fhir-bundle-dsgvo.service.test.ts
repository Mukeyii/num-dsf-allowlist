/**
 * fhir-bundle-dsgvo.service.test.ts — DB-backed contract + DSGVO tests for
 * fhir.service generateBundle / generateFullBundle.
 *
 * generateBundle: seeds ONE complete instance (organization + endpoint +
 * endpoint_ips + certificate + membership + a CONTACT carrying recognizable
 * PII) and asserts the bundle is a transaction Bundle that embeds the
 * Organization and Endpoint with the expected identifiers/address, embeds the
 * certificate thumbprint as an extension, AND — the load-bearing DSGVO check —
 * never leaks the contact's email or other contact PII into the serialized
 * bundle JSON.
 *
 * generateFullBundle: seeds an APPROVED instance and a non-approved (DRAFT)
 * instance and asserts the network-wide bundle aggregates only the approved
 * organization, excluding the non-approved one.
 *
 * Each test seeds its own fresh rows with unique identifiers so parallel
 * suites never collide; teardown removes only the rows it created.
 *
 * Dependencies: db/connection, fhir.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { generateBundle, generateFullBundle } from '../services/fhir.service';

interface Coding {
  system: string;
  code: string;
}
interface Resource {
  resourceType: string;
  id: string;
  name?: string;
  address?: string;
  active?: boolean;
  identifier?: Array<{ system: string; value: string }>;
  extension?: Array<{ url: string; valueString: string }>;
  endpoint?: Array<{ reference: string }>;
}
interface Entry {
  fullUrl: string;
  resource: Resource;
}
interface Bundle {
  resourceType: string;
  type: string;
  entry: Entry[];
}

const uniq = (p: string) => `${p}-${Date.now()}-${uuidv4().slice(0, 8)}`;

describe('fhir.service – generateBundle (single instance + DSGVO)', () => {
  const userId = uuidv4();
  const instanceId = uuidv4();
  const orgId = `${uniq('fhir-org')}.example.de`;
  const parentId = `${uniq('fhir-verbund')}.example.de`;
  const endpointId = `dsf-fhir.${orgId}`;
  const thumbprint = 'b'.repeat(64);
  const certId = uuidv4();
  const membershipId = uuidv4();
  const contactId = uuidv4();
  const ipId = uuidv4();

  // Recognizable, unique PII that MUST NOT appear in the published bundle.
  const contactEmail = `dsgvo-leak-${Date.now()}@example.de`;
  const contactName = `Dr DsgvoLeak ${uuidv4().slice(0, 8)}`;
  const contactPhone = `+4930${String(Date.now()).slice(-7)}`;

  beforeAll(async () => {
    await db('users').insert({
      id: userId,
      email: `${userId}@example.de`,
      totp_enabled: false,
      created_at: new Date(),
    });
    await db('instances').insert({
      id: instanceId,
      user_id: userId,
      label: 'fhir-single',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: orgId,
      instance_id: instanceId,
      name: 'FHIR Single Org',
      active: true,
      email: 'org@example.de',
      address_line: 'Org Street 1',
      postal_code: '48149',
      city: 'Muenster',
      country_code: 'DE',
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('endpoints').insert({
      identifier: endpointId,
      organization_id: orgId,
      name: 'Primary FHIR Endpoint',
      address: `https://${endpointId}/fhir`,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('endpoint_ips').insert({
      id: ipId,
      endpoint_id: endpointId,
      ip: '10.20.30.40',
      is_fhir: true,
      is_bpe: false,
    });
    await db('certificates').insert({
      id: certId,
      organization_id: orgId,
      pem: 'CERT-MARKER',
      subject: `CN=${orgId}`,
      thumbprint,
      valid_until: '2099-01-01',
      created_at: new Date(),
    });
    await db('memberships').insert({
      id: membershipId,
      organization_id: orgId,
      parent_organization: parentId,
      endpoint_id: endpointId,
      roles: JSON.stringify(['DIC', 'HRP']),
      created_at: new Date(),
      updated_at: new Date(),
    });
    // The contact lives under the same org but must never reach the bundle.
    await db('contacts').insert({
      id: contactId,
      organization_id: orgId,
      types: JSON.stringify(['DSF_ADMIN']),
      name: contactName,
      email: contactEmail,
      email_validated: true,
      phone: contactPhone,
      address_line: 'Secret Street 9',
      city: 'Muenster',
      postal_code: '48149',
      country_code: 'DE',
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  afterAll(async () => {
    try {
      await db('contacts').where({ organization_id: orgId }).del();
      await db('memberships').where({ organization_id: orgId }).del();
      await db('certificates').where({ organization_id: orgId }).del();
      await db('endpoint_ips').where({ endpoint_id: endpointId }).del();
      await db('endpoints').where({ identifier: endpointId }).del();
    } finally {
      await db('organizations').where({ identifier: orgId }).del();
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });

  it('returns a FHIR transaction Bundle', async () => {
    const bundle = (await generateBundle(instanceId, endpointId)) as Bundle;
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('transaction');
    expect(Array.isArray(bundle.entry)).toBe(true);
  });

  it('embeds the Organization with the expected identifier and name', async () => {
    const bundle = (await generateBundle(instanceId, endpointId)) as Bundle;
    const orgEntry = bundle.entry.find(
      (e) =>
        e.resource.resourceType === 'Organization' &&
        (e.resource.identifier ?? []).some((i) => i.value === orgId),
    );
    expect(orgEntry).toBeDefined();
    expect(orgEntry!.resource.name).toBe('FHIR Single Org');
    expect(orgEntry!.resource.active).toBe(true);
  });

  it('embeds the Endpoint with the expected identifier and FHIR address', async () => {
    const bundle = (await generateBundle(instanceId, endpointId)) as Bundle;
    const epEntry = bundle.entry.find(
      (e) =>
        e.resource.resourceType === 'Endpoint' &&
        (e.resource.identifier ?? []).some((i) => i.value === endpointId),
    );
    expect(epEntry).toBeDefined();
    expect(epEntry!.resource.address).toBe(`https://${endpointId}/fhir`);
    expect(epEntry!.resource.name).toBe('Primary FHIR Endpoint');
  });

  it('embeds the certificate thumbprint as an Organization extension', async () => {
    const bundle = (await generateBundle(instanceId, endpointId)) as Bundle;
    const orgEntry = bundle.entry.find(
      (e) =>
        e.resource.resourceType === 'Organization' &&
        (e.resource.identifier ?? []).some((i) => i.value === orgId),
    );
    const ext = orgEntry!.resource.extension ?? [];
    expect(
      ext.some(
        (x) =>
          x.url === 'http://dsf.dev/fhir/StructureDefinition/extension-certificate-thumbprint' &&
          x.valueString === thumbprint,
      ),
    ).toBe(true);
  });

  it('emits an OrganizationAffiliation referencing the parent verbund', async () => {
    const bundle = (await generateBundle(instanceId, endpointId)) as Bundle;
    const aff = bundle.entry.find((e) => e.resource.resourceType === 'OrganizationAffiliation');
    expect(aff).toBeDefined();
    // Parent verbund Organization is emitted so the affiliation reference resolves.
    const parentOrg = bundle.entry.find(
      (e) =>
        e.resource.resourceType === 'Organization' &&
        (e.resource.identifier ?? []).some((i) => i.value === parentId),
    );
    expect(parentOrg).toBeDefined();
  });

  it('DSGVO: the serialized bundle never contains the contact email or PII', async () => {
    const bundle = await generateBundle(instanceId, endpointId);
    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toContain(contactEmail);
    expect(serialized).not.toContain(contactName);
    expect(serialized).not.toContain(contactPhone);
    expect(serialized).not.toContain('Secret Street 9');
    // Defensive: the contact row's primary key must not leak either.
    expect(serialized).not.toContain(contactId);
  });
});

describe('fhir.service – generateFullBundle (approved-only aggregation)', () => {
  const userId = uuidv4();
  const approvedInstanceId = uuidv4();
  const draftInstanceId = uuidv4();
  const approvedOrgId = `${uniq('fb-approved')}.example.de`;
  const draftOrgId = `${uniq('fb-draft')}.example.de`;
  const verbundId = `${uniq('fb-verbund')}.example.de`;
  const approvedEpId = `dsf-fhir.${approvedOrgId}`;

  beforeAll(async () => {
    await db('users').insert({
      id: userId,
      email: `${userId}@example.de`,
      totp_enabled: false,
      created_at: new Date(),
    });
    await db('instances').insert([
      { id: approvedInstanceId, user_id: userId, label: 'fb-approved', created_at: new Date() },
      { id: draftInstanceId, user_id: userId, label: 'fb-draft', created_at: new Date() },
    ]);
    await db('organizations').insert([
      {
        identifier: approvedOrgId,
        instance_id: approvedInstanceId,
        name: 'FB Approved',
        active: true,
        email: 'a@example.de',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        identifier: draftOrgId,
        instance_id: draftInstanceId,
        name: 'FB Draft',
        active: true,
        email: 'd@example.de',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    await db('endpoints').insert({
      identifier: approvedEpId,
      organization_id: approvedOrgId,
      name: 'FB Approved EP',
      address: `https://${approvedEpId}/fhir`,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('certificates').insert({
      id: uuidv4(),
      organization_id: approvedOrgId,
      pem: 'CERT-MARKER',
      subject: `CN=${approvedOrgId}`,
      thumbprint: 'c'.repeat(64),
      valid_until: '2099-01-01',
      created_at: new Date(),
    });
    await db('memberships').insert({
      id: uuidv4(),
      organization_id: approvedOrgId,
      parent_organization: verbundId,
      endpoint_id: approvedEpId,
      roles: JSON.stringify(['DIC']),
      created_at: new Date(),
      updated_at: new Date(),
    });
    // Only the approved instance gets an APPROVED approval_request.
    await db('approval_requests').insert({
      id: uuidv4(),
      instance_id: approvedInstanceId,
      status: 'APPROVED',
      created_at: new Date(),
      submitted_at: new Date(),
      resolved_at: new Date(),
      resolved_by: 'admin@example.de',
      snapshot_json: JSON.stringify({}),
    });
    // The draft instance has a non-approved request → its org must be excluded.
    await db('approval_requests').insert({
      id: uuidv4(),
      instance_id: draftInstanceId,
      status: 'DRAFT',
      created_at: new Date(),
      snapshot_json: JSON.stringify({}),
    });
  });

  afterAll(async () => {
    try {
      await db('memberships').where({ organization_id: approvedOrgId }).del();
      await db('certificates').where({ organization_id: approvedOrgId }).del();
      await db('endpoints').where({ identifier: approvedEpId }).del();
      await db('approval_requests')
        .whereIn('instance_id', [approvedInstanceId, draftInstanceId])
        .del();
    } finally {
      await db('organizations').whereIn('identifier', [approvedOrgId, draftOrgId]).del();
      await db('instances').whereIn('id', [approvedInstanceId, draftInstanceId]).del();
      await db('users').where({ id: userId }).del();
    }
  });

  it('aggregates the APPROVED org but excludes the non-approved org', async () => {
    const bundle = (await generateFullBundle()) as Bundle;
    const orgIds = bundle.entry.flatMap((e) =>
      e.resource.resourceType === 'Organization'
        ? (e.resource.identifier ?? []).map((i) => i.value)
        : [],
    );
    expect(orgIds).toContain(approvedOrgId);
    expect(orgIds).not.toContain(draftOrgId);
  });

  it('emits the parent verbund Organization for the approved org', async () => {
    const bundle = (await generateFullBundle()) as Bundle;
    const orgIds = bundle.entry.flatMap((e) =>
      e.resource.resourceType === 'Organization'
        ? (e.resource.identifier ?? []).map((i) => i.value)
        : [],
    );
    expect(orgIds).toContain(verbundId);
  });

  it('includes the approved org endpoint with the expected address', async () => {
    const bundle = (await generateFullBundle()) as Bundle;
    const epEntry = bundle.entry.find(
      (e) =>
        e.resource.resourceType === 'Endpoint' &&
        (e.resource.identifier ?? []).some((i) => i.value === approvedEpId),
    );
    expect(epEntry).toBeDefined();
    expect(epEntry!.resource.address).toBe(`https://${approvedEpId}/fhir`);
  });
});
