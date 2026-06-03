/**
 * fhir-bundle-endpoint-shape.test.ts
 * Regression: the Endpoint resource must carry status='active' (R4 1..1),
 * a connectionType pointing at hl7-fhir-rest, payloadType=Task in the
 * resource-types system, and a separate payloadMimeType array containing
 * both application/fhir+json and application/fhir+xml. The previous shape
 * stuffed the MIME type into payloadType.coding.code which is the wrong
 * axis and made strict DSF FHIR validators reject the resource.
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { generateBundle, generateFullBundle } from '../services/fhir.service';

const CONNECTION_SYSTEM = 'http://terminology.hl7.org/CodeSystem/endpoint-connection-type';
const RESOURCE_TYPES_SYSTEM = 'http://hl7.org/fhir/resource-types';

interface Coding {
  system?: string;
  code?: string;
}
interface ConnectionType {
  system?: string;
  code?: string;
}
interface PayloadType {
  coding?: Coding[];
}
interface EndpointResource {
  resourceType?: string;
  status?: string;
  connectionType?: ConnectionType;
  payloadType?: PayloadType[];
  payloadMimeType?: string[];
  address?: string;
  name?: string;
}
interface FhirEntry {
  resource?: EndpointResource;
}
interface FhirBundle {
  entry?: FhirEntry[];
}

function assertEndpoint(ep: EndpointResource) {
  expect(ep.status).toBe('active');
  expect(ep.connectionType?.system).toBe(CONNECTION_SYSTEM);
  expect(ep.connectionType?.code).toBe('hl7-fhir-rest');
  const ptCode = ep.payloadType?.[0]?.coding?.[0];
  expect(ptCode?.system).toBe(RESOURCE_TYPES_SYSTEM);
  expect(ptCode?.code).toBe('Task');
  expect(ep.payloadMimeType).toEqual(
    expect.arrayContaining(['application/fhir+json', 'application/fhir+xml']),
  );
  expect(typeof ep.address).toBe('string');
}

describe('Endpoint resource shape (Phase C)', () => {
  it('generateFullBundle emits the DSF-compliant Endpoint shape for every endpoint', async () => {
    const bundle = (await generateFullBundle()) as FhirBundle;
    const eps = (bundle.entry ?? []).filter((e) => e.resource?.resourceType === 'Endpoint');
    if (eps.length === 0) return; // no approved orgs in this DB — acceptable
    for (const e of eps) assertEndpoint(e.resource!);
  });

  it('generateBundle emits the same shape for a tenant-scoped bundle', async () => {
    const instanceId = uuidv4();
    const userId = uuidv4();
    const orgIdentifier = `epshape-${Date.now()}.example.de`;
    const endpointIdentifier = `dsf-fhir.${orgIdentifier}`;
    const userEmail = `epshape-${Date.now()}@example.de`;
    await db('users').insert({
      id: userId,
      email: userEmail,
      totp_enabled: false,
      created_at: new Date(),
    });
    await db('instances').insert({
      id: instanceId,
      user_id: userId,
      label: 'epshape-test',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: orgIdentifier,
      instance_id: instanceId,
      name: 'Endpoint Shape',
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
      name: null,
      address: `https://${endpointIdentifier}/fhir`,
      created_at: new Date(),
      updated_at: new Date(),
    });
    try {
      const bundle = (await generateBundle(instanceId, endpointIdentifier)) as FhirBundle;
      const ep = (bundle.entry ?? []).find((e) => e.resource?.resourceType === 'Endpoint');
      expect(ep).toBeDefined();
      assertEndpoint(ep!.resource!);
      // When endpoint.name is null in the DB, the bundle MUST fall back to
      // the 'DSF Endpoint for <fqdn>' convention used by other tools.
      expect(ep!.resource!.name).toBe(`DSF Endpoint for ${endpointIdentifier}`);
    } finally {
      await db('endpoints').where({ identifier: endpointIdentifier }).del();
      await db('organizations').where({ identifier: orgIdentifier }).del();
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });
});
