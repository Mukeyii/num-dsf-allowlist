/**
 * fhir.service.ts – FHIR R4 Bundle generation matching DSF Allow List format
 * Based on real DSF FHIR server resource structure.
 * Contact data NOT included (GDPR).
 */
import { db } from '../db/connection';

const DSF_BASE = 'http://dsf.dev';

export async function generateBundle(instanceId: string, endpointId: string): Promise<object> {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const endpoint = await db('endpoints').where({ identifier: endpointId, organization_id: org.identifier }).first();
  if (!endpoint) throw new Error('ENDPOINT_NOT_FOUND');
  const ips = await db('endpoint_ips').where({ endpoint_id: endpointId });
  const certs = await db('certificates').where({ organization_id: org.identifier });
  const memberships = await db('memberships').where({ organization_id: org.identifier });

  const readAccessTag = { system: `${DSF_BASE}/fhir/CodeSystem/read-access-tag`, code: 'ALL' };

  // Organization resource
  const orgResource: Record<string, unknown> = {
    resourceType: 'Organization',
    meta: {
      profile: [`${DSF_BASE}/fhir/StructureDefinition/organization`],
      tag: [readAccessTag],
    },
    extension: certs.map((cert: { thumbprint: string }) => ({
      url: `${DSF_BASE}/fhir/StructureDefinition/extension-certificate-thumbprint`,
      valueString: cert.thumbprint,
    })),
    identifier: [{
      system: `${DSF_BASE}/sid/organization-identifier`,
      value: org.identifier,
    }],
    active: org.active === 1 || org.active === true,
    name: org.name,
    telecom: [{
      system: 'email',
      value: org.email,
    }],
    endpoint: [{
      reference: `Endpoint/${endpoint.identifier}`,
      type: 'Endpoint',
    }],
  };

  // Endpoint resource
  const endpointResource: Record<string, unknown> = {
    resourceType: 'Endpoint',
    meta: {
      profile: [`${DSF_BASE}/fhir/StructureDefinition/endpoint`],
      tag: [readAccessTag],
    },
    identifier: [{
      system: `${DSF_BASE}/sid/endpoint-identifier`,
      value: endpoint.identifier,
    }],
    status: 'active',
    connectionType: {
      system: 'http://terminology.hl7.org/CodeSystem/endpoint-connection-type',
      code: 'hl7-fhir-rest',
    },
    managingOrganization: {
      identifier: {
        system: `${DSF_BASE}/sid/organization-identifier`,
        value: org.identifier,
      },
      type: 'Organization',
    },
    name: endpoint.name || endpoint.identifier,
    address: endpoint.address,
  };

  // OrganizationAffiliation resources
  const affiliationResources = memberships.map((ms: { id: string; parent_organization: string; endpoint_id: string; roles: string | string[] }) => {
    const roles: string[] = typeof ms.roles === 'string' ? JSON.parse(ms.roles) : ms.roles;
    return {
      resourceType: 'OrganizationAffiliation',
      meta: {
        profile: [`${DSF_BASE}/fhir/StructureDefinition/organization-affiliation`],
        tag: [readAccessTag],
      },
      active: true,
      organization: {
        identifier: {
          system: `${DSF_BASE}/sid/organization-identifier`,
          value: ms.parent_organization,
        },
        type: 'Organization',
      },
      participatingOrganization: {
        identifier: {
          system: `${DSF_BASE}/sid/organization-identifier`,
          value: org.identifier,
        },
        type: 'Organization',
      },
      code: roles.map(role => ({
        coding: [{
          system: `${DSF_BASE}/fhir/CodeSystem/organization-role`,
          code: role,
        }],
      })),
      endpoint: [{
        identifier: {
          system: `${DSF_BASE}/sid/endpoint-identifier`,
          value: ms.endpoint_id,
        },
        type: 'Endpoint',
      }],
    };
  });

  return {
    resourceType: 'Bundle',
    type: 'transaction',
    timestamp: new Date().toISOString(),
    entry: [
      {
        fullUrl: `urn:uuid:org-${org.identifier}`,
        resource: orgResource,
        request: { method: 'PUT', url: `Organization?identifier=${DSF_BASE}/sid/organization-identifier|${org.identifier}` },
      },
      {
        fullUrl: `urn:uuid:ep-${endpoint.identifier}`,
        resource: endpointResource,
        request: { method: 'PUT', url: `Endpoint?identifier=${DSF_BASE}/sid/endpoint-identifier|${endpoint.identifier}` },
      },
      ...affiliationResources.map((r: Record<string, unknown>, i: number) => ({
        fullUrl: `urn:uuid:aff-${i}`,
        resource: r,
        request: { method: 'POST', url: 'OrganizationAffiliation' },
      })),
    ],
  };
}
