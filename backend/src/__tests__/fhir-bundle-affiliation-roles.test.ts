/**
 * fhir-bundle-affiliation-roles.test.ts
 * Regression: OrganizationAffiliation.code must emit one <code> per stored
 * membership role (DIC / DMS / HRP / …) using the DSF role code system
 * http://dsf.dev/fhir/CodeSystem/organization-role. The old hardcoded
 * 'member' code was federation-hostile because consumers' ConceptMap binds
 * the DSF system only.
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { generateFullBundle } from '../services/fhir.service';

const ROLE_SYSTEM = 'http://dsf.dev/fhir/CodeSystem/organization-role';

interface Coding {
  system?: string;
  code?: string;
}
interface CodeBlock {
  coding?: Coding[];
}
interface Affiliation {
  resourceType?: string;
  code?: CodeBlock[];
}
interface FhirEntry {
  resource?: Affiliation;
  request?: { url?: string };
}
interface FhirBundle {
  entry?: FhirEntry[];
}

describe('OrganizationAffiliation role fidelity', () => {
  const instanceId = uuidv4();
  const userId = uuidv4();
  const orgIdentifier = `roles-${Date.now()}.example.de`;
  const endpointIdentifier = `dsf-fhir.${orgIdentifier}`;
  const userEmail = `roles-${Date.now()}@example.de`;
  const parentIdentifier = 'medizininformatik-initiative.de';

  beforeAll(async () => {
    await db('users').insert({
      id: userId,
      email: userEmail,
      totp_enabled: false,
      created_at: new Date(),
    });
    await db('instances').insert({
      id: instanceId,
      user_id: userId,
      label: 'roles-test',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: orgIdentifier,
      instance_id: instanceId,
      name: 'Roles Test',
      active: true,
      email: `admin@${orgIdentifier}`,
      address_line: 'x',
      postal_code: '00000',
      city: 'x',
      country_code: 'DE',
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('endpoints').insert({
      identifier: endpointIdentifier,
      organization_id: orgIdentifier,
      name: 'FHIR',
      address: `https://${endpointIdentifier}/fhir`,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('memberships').insert({
      id: uuidv4(),
      organization_id: orgIdentifier,
      parent_organization: parentIdentifier,
      endpoint_id: endpointIdentifier,
      roles: JSON.stringify(['DIC', 'DMS']),
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('approval_requests').insert({
      id: uuidv4(),
      instance_id: instanceId,
      status: 'APPROVED',
      created_at: new Date(),
      resolved_at: new Date(),
      resolved_by: userEmail,
    });
  });

  afterAll(async () => {
    await db('memberships').where({ organization_id: orgIdentifier }).del();
    await db('approval_requests').where({ instance_id: instanceId }).del();
    await db('endpoints').where({ identifier: endpointIdentifier }).del();
    await db('organizations').where({ identifier: orgIdentifier }).del();
    await db('instances').where({ id: instanceId }).del();
    await db('users').where({ id: userId }).del();
  });

  it('emits one code block per stored role using the DSF role system', async () => {
    const bundle = (await generateFullBundle()) as FhirBundle;
    const aff = (bundle.entry ?? []).find(
      (e) =>
        e.resource?.resourceType === 'OrganizationAffiliation' &&
        e.request?.url?.includes(orgIdentifier),
    );
    expect(aff).toBeDefined();
    const codes = aff!.resource!.code ?? [];
    expect(Array.isArray(codes)).toBe(true);
    expect(codes).toHaveLength(2);
    const observedRoles = new Set(codes.flatMap((c) => (c.coding ?? []).map((cd) => cd.code)));
    expect(observedRoles).toEqual(new Set(['DIC', 'DMS']));
    for (const c of codes) {
      expect(c.coding?.[0]?.system).toBe(ROLE_SYSTEM);
    }
  });
});
