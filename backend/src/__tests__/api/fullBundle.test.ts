/**
 * fullBundle.test.ts — Network-wide allow-list bundle contract.
 * - Only APPROVED + active orgs are included
 * - Cert thumbprints appear as extensions
 * - Parent verbund Organizations are present
 * - All references in the bundle resolve to a fullUrl in the same bundle
 *
 * Dependencies: generateFullBundle (fhir.service), db/connection (Knex)
 */
import { generateFullBundle } from '../../services/fhir.service';
import { db } from '../../db/connection';
import { v4 as uuidv4 } from 'uuid';

interface Resource {
  resourceType: string;
  id: string;
  identifier?: Array<{ system: string; value: string }>;
  extension?: Array<{ url: string; valueString: string }>;
  endpoint?: Array<{ reference: string }>;
  managingOrganization?: { reference: string };
  organization?: { reference: string };
  participatingOrganization?: { reference: string };
}
interface Entry { fullUrl: string; resource: Resource }

describe('generateFullBundle', () => {
  const userId = uuidv4();
  const approvedInstanceId = uuidv4();
  const draftInstanceId = uuidv4();
  const approvedOrgId = 'fb-approved.example.de';
  const draftOrgId = 'fb-draft.example.de';
  const verbundId = 'fb-verbund.example.de';
  const epId = `dsf-fhir.${approvedOrgId}`;

  beforeAll(async () => {
    await db('users').insert({ id: userId, email: 'fb@example.de', created_at: new Date() }).onConflict('email').ignore();
    await db('instances').insert([
      { id: approvedInstanceId, user_id: userId, label: 'A', created_at: new Date() },
      { id: draftInstanceId,    user_id: userId, label: 'B', created_at: new Date() },
    ]);
    await db('organizations').insert([
      { identifier: approvedOrgId, instance_id: approvedInstanceId, name: 'Approved', email: 'a@b.de', active: true, created_at: new Date(), updated_at: new Date() },
      { identifier: draftOrgId,    instance_id: draftInstanceId,    name: 'Draft',    email: 'a@b.de', active: true, created_at: new Date(), updated_at: new Date() },
    ]);
    await db('endpoints').insert({ identifier: epId, organization_id: approvedOrgId, name: 'EP', address: `https://${epId}/fhir`, created_at: new Date(), updated_at: new Date() });
    await db('certificates').insert({ id: uuidv4(), organization_id: approvedOrgId, pem: 'PEM', subject: 'CN=test', thumbprint: 'a'.repeat(64), valid_until: '2099-01-01', created_at: new Date() });
    await db('memberships').insert({ id: uuidv4(), organization_id: approvedOrgId, parent_organization: verbundId, endpoint_id: epId, roles: JSON.stringify(['DIC']), created_at: new Date(), updated_at: new Date() });
    await db('approval_requests').insert({ id: uuidv4(), instance_id: approvedInstanceId, status: 'APPROVED', created_at: new Date(), submitted_at: new Date(), resolved_at: new Date(), resolved_by: 'admin@imi-test.example.de', snapshot_json: JSON.stringify({}) });
  });

  afterAll(async () => {
    await db('memberships').where({ organization_id: approvedOrgId }).del();
    await db('certificates').where({ organization_id: approvedOrgId }).del();
    await db('endpoints').where({ identifier: epId }).del();
    await db('approval_requests').whereIn('instance_id', [approvedInstanceId, draftInstanceId]).del();
    await db('organizations').whereIn('identifier', [approvedOrgId, draftOrgId]).del();
    await db('instances').whereIn('id', [approvedInstanceId, draftInstanceId]).del();
    await db('users').where({ id: userId }).del();
  });

  it('includes the approved org but NOT the draft org', async () => {
    const bundle = await generateFullBundle() as { entry: Entry[] };
    const orgIds = bundle.entry.flatMap(e =>
      e.resource.resourceType === 'Organization' ? (e.resource.identifier ?? []).map(i => i.value) : [],
    );
    expect(orgIds).toContain(approvedOrgId);
    expect(orgIds).not.toContain(draftOrgId);
  });

  it('emits the parent verbund Organization', async () => {
    const bundle = await generateFullBundle() as { entry: Entry[] };
    const orgIds = bundle.entry.flatMap(e =>
      e.resource.resourceType === 'Organization' ? (e.resource.identifier ?? []).map(i => i.value) : [],
    );
    expect(orgIds).toContain(verbundId);
  });

  it('attaches cert thumbprint as an extension on the org', async () => {
    const bundle = await generateFullBundle() as { entry: Entry[] };
    const approvedEntry = bundle.entry.find(e =>
      e.resource.resourceType === 'Organization'
      && (e.resource.identifier ?? []).some(i => i.value === approvedOrgId),
    );
    expect(approvedEntry).toBeDefined();
    const ext = approvedEntry!.resource.extension ?? [];
    expect(ext.some(x =>
      x.url === 'http://dsf.dev/fhir/StructureDefinition/extension-certificate-thumbprint'
      && x.valueString === 'a'.repeat(64),
    )).toBe(true);
  });

  it('every internal reference resolves to a fullUrl in the same bundle', async () => {
    const bundle = await generateFullBundle() as { entry: Entry[]; identifier: { system: string; value: string } };
    expect(bundle.identifier.value).toBe('allow_list');
    const fullUrls = new Set(bundle.entry.map(e => e.fullUrl));
    const refs: string[] = [];
    for (const e of bundle.entry) {
      const r = e.resource;
      if (r.endpoint) refs.push(...r.endpoint.map(x => x.reference));
      if (r.managingOrganization) refs.push(r.managingOrganization.reference);
      if (r.organization) refs.push(r.organization.reference);
      if (r.participatingOrganization) refs.push(r.participatingOrganization.reference);
    }
    for (const ref of refs) {
      expect(fullUrls.has(ref)).toBe(true);
    }
  });
});
