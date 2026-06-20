/**
 * fhir-bundle-parentless-membership.test.ts
 * Regression: a membership with a blank parent_organization must not emit an
 * OrganizationAffiliation in the tenant-scoped bundle. Without the guard the
 * parent UUID lookup returns undefined and the resource carries a dangling
 * `urn:uuid:undefined` reference, which strict DSF validators reject.
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { generateBundle } from '../services/fhir.service';

interface FhirEntry {
  fullUrl?: string;
  resource?: { resourceType?: string };
  request?: { url?: string };
}
interface FhirBundle {
  entry?: FhirEntry[];
}

describe('Tenant bundle skips parentless memberships', () => {
  it('emits no affiliation and no urn:uuid:undefined for a blank parent_organization', async () => {
    const instanceId = uuidv4();
    const userId = uuidv4();
    const orgIdentifier = `parentless-${Date.now()}.example.de`;
    const endpointIdentifier = `dsf-fhir.${orgIdentifier}`;
    const userEmail = `parentless-${Date.now()}@example.de`;
    await db('users').insert({
      id: userId,
      email: userEmail,
      totp_enabled: false,
      created_at: new Date(),
    });
    await db('instances').insert({
      id: instanceId,
      user_id: userId,
      label: 'parentless-test',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: orgIdentifier,
      instance_id: instanceId,
      name: 'Parentless Test',
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
      parent_organization: '',
      endpoint_id: endpointIdentifier,
      roles: JSON.stringify(['DIC']),
      created_at: new Date(),
      updated_at: new Date(),
    });
    try {
      const bundle = (await generateBundle(instanceId, endpointIdentifier)) as FhirBundle;
      const entries = bundle.entry ?? [];
      const affiliations = entries.filter(
        (e) => e.resource?.resourceType === 'OrganizationAffiliation',
      );
      expect(affiliations).toHaveLength(0);
      const serialized = JSON.stringify(bundle);
      expect(serialized).not.toContain('urn:uuid:undefined');
    } finally {
      await db('memberships').where({ organization_id: orgIdentifier }).del();
      await db('endpoints').where({ identifier: endpointIdentifier }).del();
      await db('organizations').where({ identifier: orgIdentifier }).del();
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });
});
