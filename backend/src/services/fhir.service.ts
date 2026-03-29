/**
 * fhir.service.ts – FHIR R4 Bundle generation per DSF Process Allow List spec
 * Generates a transaction bundle with Organization, Endpoint, and OrganizationAffiliation resources.
 * Contact data NOT included (GDPR).
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

const ORG_ID_SYSTEM = 'http://dsf.dev/fhir/NamingSystem/organization-identifier';
const EP_ID_SYSTEM = 'http://dsf.dev/fhir/NamingSystem/endpoint-identifier';
const ALLOW_LIST_SYSTEM = 'http://dsf.dev/fhir/CodeSystem/allow-list';
const ORG_ROLE_SYSTEM = 'http://hl7.org/fhir/organization-role';

/**
 * Generate a DSF-compliant Allow List transaction bundle for an instance+endpoint.
 * Includes: Organization, Endpoint, and OrganizationAffiliation resources.
 * All resources use urn:uuid: references and conditional PUT requests.
 */
export async function generateBundle(instanceId: string, endpointId: string): Promise<object> {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const endpoint = await db('endpoints').where({ identifier: endpointId, organization_id: org.identifier }).first();
  if (!endpoint) throw new Error('ENDPOINT_NOT_FOUND');
  const certs = await db('certificates').where({ organization_id: org.identifier });
  const memberships = await db('memberships').where({ organization_id: org.identifier });

  // Generate stable UUIDs for cross-referencing within the bundle
  const orgUuid = uuidv4();
  const epUuid = uuidv4();

  // Also need UUIDs for parent organizations referenced in affiliations
  const parentOrgUuids: Record<string, string> = {};
  for (const ms of memberships) {
    const parentId = typeof ms === 'object' ? ms.parent_organization : '';
    if (parentId && !parentOrgUuids[parentId]) {
      parentOrgUuids[parentId] = uuidv4();
    }
  }

  const entries: object[] = [];

  // --- Organization entry ---
  entries.push({
    fullUrl: `urn:uuid:${orgUuid}`,
    resource: {
      resourceType: 'Organization',
      id: `urn:uuid:${orgUuid}`,
      meta: { versionId: null, lastUpdated: null },
      extension: certs.map((cert: { thumbprint: string }) => ({
        url: 'http://dsf.dev/fhir/StructureDefinition/extension-certificate-thumbprint',
        valueString: cert.thumbprint,
      })),
      identifier: [{ system: ORG_ID_SYSTEM, value: org.identifier }],
      active: true,
      name: org.name,
      endpoint: [{ reference: `urn:uuid:${epUuid}`, type: 'Endpoint' }],
    },
    request: {
      method: 'PUT',
      url: `Organization?identifier=${ORG_ID_SYSTEM}|${org.identifier}`,
    },
  });

  // --- Endpoint entry ---
  entries.push({
    fullUrl: `urn:uuid:${epUuid}`,
    resource: {
      resourceType: 'Endpoint',
      id: `urn:uuid:${epUuid}`,
      meta: { versionId: null, lastUpdated: null },
      identifier: [{ system: EP_ID_SYSTEM, value: endpoint.identifier }],
      name: endpoint.name || endpoint.identifier,
      address: endpoint.address,
      payloadType: [{ coding: [{ code: 'application/fhir+json' }] }],
      managingOrganization: { reference: `urn:uuid:${orgUuid}`, type: 'Organization' },
    },
    request: {
      method: 'PUT',
      url: `Endpoint?identifier=${EP_ID_SYSTEM}|${endpoint.identifier}`,
    },
  });

  // --- Parent Organization entries (for each unique parent) ---
  for (const [parentId, parentUuid] of Object.entries(parentOrgUuids)) {
    // Check if parent org exists in our DB (it might be an external consortium like MII)
    const parentOrg = await db('organizations').where({ identifier: parentId }).first();
    entries.push({
      fullUrl: `urn:uuid:${parentUuid}`,
      resource: {
        resourceType: 'Organization',
        id: `urn:uuid:${parentUuid}`,
        meta: { versionId: null, lastUpdated: null },
        identifier: [{ system: ORG_ID_SYSTEM, value: parentId }],
        active: true,
        name: parentOrg?.name || parentId,
      },
      request: {
        method: 'PUT',
        url: `Organization?identifier=${ORG_ID_SYSTEM}|${parentId}`,
      },
    });
  }

  // --- OrganizationAffiliation entries ---
  for (const ms of memberships) {
    const parentId: string = ms.parent_organization;
    const msEndpointId: string = ms.endpoint_id;
    const parentUuid = parentOrgUuids[parentId];
    const affUuid = uuidv4();

    entries.push({
      fullUrl: `urn:uuid:${affUuid}`,
      resource: {
        resourceType: 'OrganizationAffiliation',
        id: `urn:uuid:${affUuid}`,
        meta: { versionId: null, lastUpdated: null },
        organization: { reference: `urn:uuid:${parentUuid}`, type: 'Organization' },
        participatingOrganization: { reference: `urn:uuid:${orgUuid}`, type: 'Organization' },
        code: [{ coding: [{ system: ORG_ROLE_SYSTEM, code: 'member' }] }],
        endpoint: [{ reference: `urn:uuid:${epUuid}`, type: 'Endpoint' }],
      },
      request: {
        method: 'PUT',
        url: `OrganizationAffiliation?primary-organization:identifier=${ORG_ID_SYSTEM}|${parentId}&participating-organization:identifier=${ORG_ID_SYSTEM}|${org.identifier}&endpoint:identifier=${EP_ID_SYSTEM}|${msEndpointId}`,
      },
    });
  }

  return {
    resourceType: 'Bundle',
    type: 'transaction',
    identifier: { system: ALLOW_LIST_SYSTEM, value: 'allow_list' },
    entry: entries,
  };
}

/**
 * Generate a full allow list bundle containing ALL organizations, endpoints, and affiliations.
 * Used for the global bundle download (not scoped to a single instance).
 */
export async function generateFullBundle(): Promise<object> {
  const orgs = await db('organizations').where({ active: true });
  const entries: object[] = [];
  const orgUuids: Record<string, string> = {};
  const epUuids: Record<string, string> = {};

  // Generate UUIDs for all orgs
  for (const org of orgs) {
    orgUuids[org.identifier] = uuidv4();
  }

  // Organizations + their endpoints
  for (const org of orgs) {
    const orgUuid = orgUuids[org.identifier];
    const endpoints = await db('endpoints').where({ organization_id: org.identifier });
    const certs = await db('certificates').where({ organization_id: org.identifier });

    // Generate endpoint UUIDs
    for (const ep of endpoints) {
      epUuids[ep.identifier] = uuidv4();
    }

    entries.push({
      fullUrl: `urn:uuid:${orgUuid}`,
      resource: {
        resourceType: 'Organization',
        id: `urn:uuid:${orgUuid}`,
        meta: { versionId: null, lastUpdated: null },
        extension: certs.map((cert: { thumbprint: string }) => ({
          url: 'http://dsf.dev/fhir/StructureDefinition/extension-certificate-thumbprint',
          valueString: cert.thumbprint,
        })),
        identifier: [{ system: ORG_ID_SYSTEM, value: org.identifier }],
        active: true,
        name: org.name,
        endpoint: endpoints.map((ep: { identifier: string }) => ({
          reference: `urn:uuid:${epUuids[ep.identifier]}`,
          type: 'Endpoint',
        })),
      },
      request: { method: 'PUT', url: `Organization?identifier=${ORG_ID_SYSTEM}|${org.identifier}` },
    });

    for (const ep of endpoints) {
      entries.push({
        fullUrl: `urn:uuid:${epUuids[ep.identifier]}`,
        resource: {
          resourceType: 'Endpoint',
          id: `urn:uuid:${epUuids[ep.identifier]}`,
          meta: { versionId: null, lastUpdated: null },
          identifier: [{ system: EP_ID_SYSTEM, value: ep.identifier }],
          name: ep.name || ep.identifier,
          address: ep.address,
          payloadType: [{ coding: [{ code: 'application/fhir+json' }] }],
          managingOrganization: { reference: `urn:uuid:${orgUuid}`, type: 'Organization' },
        },
        request: { method: 'PUT', url: `Endpoint?identifier=${EP_ID_SYSTEM}|${ep.identifier}` },
      });
    }
  }

  // OrganizationAffiliations
  const memberships = await db('memberships');
  for (const ms of memberships) {
    const parentUuid = orgUuids[ms.parent_organization];

    // Find the org for this membership to get its identifier
    const memberOrg = orgs.find((o: { identifier: string }) => o.identifier === ms.organization_id);
    if (!memberOrg || !parentUuid) continue;

    const affUuid = uuidv4();
    const epUuid = epUuids[ms.endpoint_id] || uuidv4();

    entries.push({
      fullUrl: `urn:uuid:${affUuid}`,
      resource: {
        resourceType: 'OrganizationAffiliation',
        id: `urn:uuid:${affUuid}`,
        meta: { versionId: null, lastUpdated: null },
        organization: { reference: `urn:uuid:${parentUuid}`, type: 'Organization' },
        participatingOrganization: { reference: `urn:uuid:${orgUuids[memberOrg.identifier]}`, type: 'Organization' },
        code: [{ coding: [{ system: ORG_ROLE_SYSTEM, code: 'member' }] }],
        endpoint: [{ reference: `urn:uuid:${epUuid}`, type: 'Endpoint' }],
      },
      request: {
        method: 'PUT',
        url: `OrganizationAffiliation?primary-organization:identifier=${ORG_ID_SYSTEM}|${ms.parent_organization}&participating-organization:identifier=${ORG_ID_SYSTEM}|${memberOrg.identifier}&endpoint:identifier=${EP_ID_SYSTEM}|${ms.endpoint_id}`,
      },
    });
  }

  return {
    resourceType: 'Bundle',
    type: 'transaction',
    identifier: { system: ALLOW_LIST_SYSTEM, value: 'allow_list' },
    entry: entries,
  };
}
