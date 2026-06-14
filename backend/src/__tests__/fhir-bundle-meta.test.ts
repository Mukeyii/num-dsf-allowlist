/**
 * fhir-bundle-meta.test.ts
 * Regression: the DSF spec requires every emitted resource — and the Bundle
 * envelope itself — to carry a read-access-tag and a meta.profile that picks
 * the strict validator on the receiver side. Without these, DSF FHIR servers
 * either reject the bundle outright or fall back to generic R4 validation
 * (which misses DSF-specific cardinalities and bindings).
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { generateBundle, generateFullBundle } from '../services/fhir.service';

const TAG_SYSTEM = 'http://dsf.dev/fhir/CodeSystem/read-access-tag';
const PROFILE_ORG = 'http://dsf.dev/fhir/StructureDefinition/organization';
const PROFILE_ORG_PARENT = 'http://dsf.dev/fhir/StructureDefinition/organization-parent';
const PROFILE_ENDPOINT = 'http://dsf.dev/fhir/StructureDefinition/endpoint';
const PROFILE_AFFILIATION = 'http://dsf.dev/fhir/StructureDefinition/organization-affiliation';

interface MetaTag {
  system: string;
  code: string;
}
interface Meta {
  tag?: MetaTag[];
  profile?: string[];
}
interface FhirResource {
  resourceType?: string;
  meta?: Meta;
  extension?: unknown[];
}
interface FhirEntry {
  resource?: FhirResource;
}
interface FhirBundle {
  meta?: Meta;
  entry?: FhirEntry[];
}

function hasReadAccessTag(meta: Meta | undefined): boolean {
  return !!meta?.tag?.some((t) => t.system === TAG_SYSTEM && t.code === 'ALL');
}

describe('Bundle meta + per-resource meta (Phase A)', () => {
  it('Bundle envelope carries read-access-tag ALL', async () => {
    const bundle = (await generateFullBundle()) as FhirBundle;
    expect(hasReadAccessTag(bundle.meta)).toBe(true);
  });

  it('every emitted resource carries read-access-tag ALL', async () => {
    const bundle = (await generateFullBundle()) as FhirBundle;
    for (const entry of bundle.entry ?? []) {
      if (!entry.resource) continue; // DELETE entries have no resource
      expect(hasReadAccessTag(entry.resource.meta)).toBe(true);
    }
  });

  it('Organization resources carry the correct DSF profile', async () => {
    const bundle = (await generateFullBundle()) as FhirBundle;
    const orgs = (bundle.entry ?? []).filter((e) => e.resource?.resourceType === 'Organization');
    for (const o of orgs) {
      const profiles = o.resource!.meta?.profile ?? [];
      const isParent = !(o.resource!.extension ?? []).length;
      expect(profiles).toContain(isParent ? PROFILE_ORG_PARENT : PROFILE_ORG);
    }
  });

  it('Endpoint resources carry the endpoint profile', async () => {
    const bundle = (await generateFullBundle()) as FhirBundle;
    const eps = (bundle.entry ?? []).filter((e) => e.resource?.resourceType === 'Endpoint');
    for (const ep of eps) {
      expect(ep.resource!.meta?.profile).toContain(PROFILE_ENDPOINT);
    }
  });

  it('OrganizationAffiliation resources carry the affiliation profile', async () => {
    const bundle = (await generateFullBundle()) as FhirBundle;
    const affs = (bundle.entry ?? []).filter(
      (e) => e.resource?.resourceType === 'OrganizationAffiliation',
    );
    for (const a of affs) {
      expect(a.resource!.meta?.profile).toContain(PROFILE_AFFILIATION);
    }
  });

  it('tenant-scoped generateBundle also carries the read-access-tag', async () => {
    // Seed a minimal instance so generateBundle has something to render.
    const instanceId = uuidv4();
    const userId = uuidv4();
    const orgIdentifier = `meta-test-${Date.now()}.example.de`;
    const endpointIdentifier = `dsf-fhir.${orgIdentifier}`;
    const userEmail = `meta-test-${Date.now()}@example.de`;
    await db('users').insert({
      id: userId,
      email: userEmail,
      totp_enabled: false,
      created_at: new Date(),
    });
    await db('instances').insert({
      id: instanceId,
      user_id: userId,
      label: 'meta-test',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: orgIdentifier,
      instance_id: instanceId,
      name: 'Meta Test',
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
    try {
      const bundle = (await generateBundle(instanceId, endpointIdentifier)) as FhirBundle;
      expect(hasReadAccessTag(bundle.meta)).toBe(true);
      const org = (bundle.entry ?? []).find((e) => e.resource?.resourceType === 'Organization');
      expect(hasReadAccessTag(org?.resource?.meta)).toBe(true);
      // No certificates seeded → extension must be absent, not an empty array
      // (FHIR R4 rejects extension: []).
      expect(org?.resource).not.toHaveProperty('extension');
    } finally {
      await db('endpoints').where({ identifier: endpointIdentifier }).del();
      await db('organizations').where({ identifier: orgIdentifier }).del();
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });
});
