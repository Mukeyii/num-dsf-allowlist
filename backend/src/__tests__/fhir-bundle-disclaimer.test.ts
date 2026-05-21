/**
 * fhir-bundle-disclaimer.test.ts
 * Regression: every bundle generator must attach the legal disclaimer
 * extension to bundle.meta.extension. Other AllowList tools consume this
 * extension to surface the verification responsibility to the receiving
 * site.
 *
 * Dependencies: generateFullBundle, generateBundle (fhir.service), db
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { generateFullBundle, generateBundle } from '../services/fhir.service';

interface DisclaimerExt { url: string; valueString: string }
interface BundleWithMeta {
  resourceType: 'Bundle';
  meta?: { extension?: DisclaimerExt[] };
  entry?: unknown[];
}

const DISCLAIMER_URL = 'http://dsf.dev/fhir/StructureDefinition/bundle-disclaimer';

function findDisclaimer(bundle: BundleWithMeta): DisclaimerExt | undefined {
  return bundle.meta?.extension?.find(e => e.url === DISCLAIMER_URL);
}

describe('Bundle disclaimer extension', () => {
  it('generateFullBundle attaches the disclaimer to meta.extension', async () => {
    const bundle = (await generateFullBundle()) as BundleWithMeta;
    const ext = findDisclaimer(bundle);
    expect(ext).toBeDefined();
    expect(ext!.valueString).toMatch(/receiving site/i);
    expect(ext!.valueString).toMatch(/responsible/i);
    expect(ext!.valueString).toMatch(/verify/i);
  });

  it('generateBundle attaches the disclaimer for tenant-scoped bundles', async () => {
    // Use any existing approved org's instance+endpoint pair. If none exists
    // the test seeds one ad-hoc so it is robust against an empty DB.
    const instanceId = uuidv4();
    const userId = uuidv4();
    const orgIdentifier = `disclaimer-test-${Date.now()}.example.de`;
    const endpointIdentifier = `dsf-fhir.${orgIdentifier}`;
    const userEmail = `disclaimer-test-${Date.now()}@example.de`;

    await db('users').insert({ id: userId, email: userEmail, totp_enabled: false, created_at: new Date() });
    await db('instances').insert({ id: instanceId, user_id: userId, label: 'disclaimer-test', created_at: new Date() });
    await db('organizations').insert({
      identifier: orgIdentifier, instance_id: instanceId, name: 'Disclaimer Test Org', active: true,
      email: `admin@${orgIdentifier}`, address_line: 'x', postal_code: '00000', city: 'x', country_code: 'DE',
      created_at: new Date(), updated_at: new Date(),
    });
    await db('endpoints').insert({
      identifier: endpointIdentifier, organization_id: orgIdentifier, name: 'FHIR', address: `https://${endpointIdentifier}/fhir`,
      created_at: new Date(), updated_at: new Date(),
    });

    try {
      const bundle = (await generateBundle(instanceId, endpointIdentifier)) as BundleWithMeta;
      expect(findDisclaimer(bundle)).toBeDefined();
    } finally {
      await db('endpoints').where({ identifier: endpointIdentifier }).del();
      await db('organizations').where({ identifier: orgIdentifier }).del();
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });
});
