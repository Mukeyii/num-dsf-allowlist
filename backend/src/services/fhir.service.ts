/**
 * fhir.service.ts – FHIR R4 Bundle generation
 * Contact data NOT included (GDPR).
 */
import { db } from '../db/connection';

const DSF_BASE_URL = process.env.DSF_FHIR_BASE_URL || 'https://dsf.dev';

export async function generateBundle(instanceId: string, endpointId: string): Promise<object> {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const endpoint = await db('endpoints').where({ identifier: endpointId, organization_id: org.identifier }).first();
  if (!endpoint) throw new Error('ENDPOINT_NOT_FOUND');
  const ips = await db('endpoint_ips').where({ endpoint_id: endpointId });
  const certs = await db('certificates').where({ organization_id: org.identifier });
  const memberships = await db('memberships').where({ organization_id: org.identifier });

  const orgResource = {
    resourceType: 'Organization', id: org.identifier,
    meta: { profile: [`${DSF_BASE_URL}/fhir/StructureDefinition/dsf-organization`] },
    identifier: [{ system: `${DSF_BASE_URL}/fhir/NamingSystem/dsf-identifier`, value: org.identifier }],
    active: org.active === 1, name: org.name,
    extension: certs.map((cert: any) => ({ url: `${DSF_BASE_URL}/fhir/StructureDefinition/dsf-certificate`, valueBase64Binary: Buffer.from(cert.pem).toString('base64') })),
  };

  const endpointResource = {
    resourceType: 'Endpoint', id: endpoint.identifier,
    meta: { profile: [`${DSF_BASE_URL}/fhir/StructureDefinition/dsf-endpoint`] },
    identifier: [{ system: `${DSF_BASE_URL}/fhir/NamingSystem/dsf-identifier`, value: endpoint.identifier }],
    status: 'active',
    connectionType: { system: 'http://terminology.hl7.org/CodeSystem/endpoint-connection-type', code: 'hl7-fhir-rest' },
    managingOrganization: { reference: `Organization/${org.identifier}` },
    address: endpoint.address,
    extension: ips.map((ip: any) => ({
      url: `${DSF_BASE_URL}/fhir/StructureDefinition/dsf-extension-endpoint-ip`,
      extension: [{ url: 'ip', valueString: ip.ip }, { url: 'isFhir', valueBoolean: ip.is_fhir === 1 }, { url: 'isBpe', valueBoolean: ip.is_bpe === 1 }],
    })),
  };

  const affiliationResources = memberships.map((ms: any) => ({
    resourceType: 'OrganizationAffiliation', id: ms.id, active: true,
    organization: { identifier: { system: `${DSF_BASE_URL}/fhir/NamingSystem/dsf-identifier`, value: ms.parent_organization } },
    participatingOrganization: { reference: `Organization/${org.identifier}` },
    endpoint: [{ reference: `Endpoint/${ms.endpoint_id}` }],
    code: JSON.parse(ms.roles).map((role: string) => ({ coding: [{ system: `${DSF_BASE_URL}/fhir/CodeSystem/dsf-organization-role`, code: role }] })),
  }));

  return {
    resourceType: 'Bundle', type: 'collection', timestamp: new Date().toISOString(),
    meta: { profile: [`${DSF_BASE_URL}/fhir/StructureDefinition/dsf-allowlist`] },
    entry: [{ resource: orgResource }, { resource: endpointResource }, ...affiliationResources.map((r: any) => ({ resource: r }))],
  };
}
