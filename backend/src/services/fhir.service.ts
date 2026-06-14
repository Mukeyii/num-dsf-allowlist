/**
 * fhir.service.ts – FHIR R4 Bundle generation per DSF Process Allow List spec
 * Generates a transaction bundle with Organization, Endpoint, and OrganizationAffiliation resources.
 * Contact data NOT included (GDPR).
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

// Canonical DSF identifier systems (the 'sid' / SystemIDentifier slot). Other
// AllowList tools in production use these exact URLs — see the reference
// bundle. Our previous fhir/NamingSystem/* paths were non-canonical and
// caused silent federation desync because identifier systems didn't match.
const ORG_ID_SYSTEM = 'http://dsf.dev/sid/organization-identifier';
const EP_ID_SYSTEM = 'http://dsf.dev/sid/endpoint-identifier';
// DSF namespaces the role code system, separate from the generic HL7 one.
// Reference XML uses http://dsf.dev/fhir/CodeSystem/organization-role with
// codes like DIC, DMS, HRP. Federation peers reject our 'member' code as
// unknown when we use the HL7 system, because their ConceptMap binds the
// DSF system only.
const ORG_ROLE_SYSTEM = 'http://dsf.dev/fhir/CodeSystem/organization-role';

// Robustly read the stored roles JSON column. MySQL/Knex returns JSON
// columns as already-parsed JS arrays in most setups, but tests and older
// drivers can hand back a string — accept both.
function readRoles(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((r): r is string => typeof r === 'string');
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((r): r is string => typeof r === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}
const DISCLAIMER_EXTENSION_URL = 'http://dsf.dev/fhir/StructureDefinition/bundle-disclaimer';

// DSF FHIR servers require every emitted resource (and the Bundle envelope)
// to declare its read-access scope via meta.tag. 'ALL' = readable by every
// authenticated peer in the federation. Without this tag a DSF FHIR server
// treats the resource as LOCAL scope and rejects the bundle.
const READ_ACCESS_TAG_SYSTEM = 'http://dsf.dev/fhir/CodeSystem/read-access-tag';
const READ_ACCESS_TAG_ALL = {
  system: READ_ACCESS_TAG_SYSTEM,
  code: 'ALL',
  display: 'everybody',
} as const;

// DSF profile URLs for the four resource types in an allow-list bundle.
const PROFILE_ORG = 'http://dsf.dev/fhir/StructureDefinition/organization';
const PROFILE_ORG_PARENT = 'http://dsf.dev/fhir/StructureDefinition/organization-parent';
const PROFILE_ENDPOINT = 'http://dsf.dev/fhir/StructureDefinition/endpoint';
const PROFILE_AFFILIATION = 'http://dsf.dev/fhir/StructureDefinition/organization-affiliation';

// Build the `meta` block every emitted resource needs. profile picks the
// strict validator on the receiver side; tag advertises read-access scope.
function resourceMeta(profile: string) {
  return {
    profile: [profile],
    tag: [READ_ACCESS_TAG_ALL],
  };
}

// Legal disclaimer attached to every emitted bundle's `meta.extension`.
// Other AllowList tools and DSF FHIR consumers MUST treat this bundle as a
// recommendation; the receiving site is solely responsible for verifying
// content, signature, and provenance before deployment.
const BUNDLE_DISCLAIMER_EXTENSION = {
  url: DISCLAIMER_EXTENSION_URL,
  valueString:
    'This Allow-List bundle is a recommendation. The receiving site is responsible ' +
    'for verifying its contents, signature, and provenance before deployment. The ' +
    'Institute of Medical Informatics Muenster operates this tool but does not ' +
    'assume liability for unverified installation at receiving sites.',
} as const;

const BUNDLE_META = {
  tag: [READ_ACCESS_TAG_ALL],
  extension: [BUNDLE_DISCLAIMER_EXTENSION],
} as const;

/**
 * Generate a DSF-compliant Allow List transaction bundle for an instance+endpoint.
 * Includes: Organization, Endpoint, and OrganizationAffiliation resources.
 * All resources use urn:uuid: references and conditional PUT requests.
 */
export async function generateBundle(instanceId: string, endpointId: string): Promise<object> {
  const org = await db('organizations').where({ instance_id: instanceId }).first();
  if (!org) throw new Error('ORGANIZATION_NOT_FOUND');
  const endpoint = await db('endpoints')
    .where({ identifier: endpointId, organization_id: org.identifier })
    .first();
  if (!endpoint) throw new Error('ENDPOINT_NOT_FOUND');
  const certs = await db('certificates').where({ organization_id: org.identifier });
  const memberships = await db('memberships')
    .where({ organization_id: org.identifier })
    .whereNull('deleted_at');

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
  // FHIR R4: extension must be absent or non-empty — never []. Omit the key
  // entirely when the org has no certificate thumbprints.
  const orgCertExtensions = certs.map((cert: { thumbprint: string }) => ({
    url: 'http://dsf.dev/fhir/StructureDefinition/extension-certificate-thumbprint',
    valueString: cert.thumbprint,
  }));
  entries.push({
    fullUrl: `urn:uuid:${orgUuid}`,
    resource: {
      resourceType: 'Organization',
      id: orgUuid,
      meta: resourceMeta(PROFILE_ORG),
      ...(orgCertExtensions.length ? { extension: orgCertExtensions } : {}),
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
  // DSF spec maps:
  //   status         = 'active' (FHIR R4 1..1 cardinality)
  //   connectionType = hl7-fhir-rest from
  //                    http://terminology.hl7.org/CodeSystem/endpoint-connection-type
  //   payloadType    = Task from http://hl7.org/fhir/resource-types
  //                    (the WORK type carried, not the MIME wrapper)
  //   payloadMimeType = ['application/fhir+json', 'application/fhir+xml']
  //                    separate top-level array, not folded into payloadType.
  entries.push({
    fullUrl: `urn:uuid:${epUuid}`,
    resource: {
      resourceType: 'Endpoint',
      id: epUuid,
      meta: resourceMeta(PROFILE_ENDPOINT),
      identifier: [{ system: EP_ID_SYSTEM, value: endpoint.identifier }],
      status: 'active',
      connectionType: {
        system: 'http://terminology.hl7.org/CodeSystem/endpoint-connection-type',
        code: 'hl7-fhir-rest',
      },
      name: endpoint.name || `DSF Endpoint for ${endpoint.identifier}`,
      managingOrganization: { reference: `urn:uuid:${orgUuid}`, type: 'Organization' },
      payloadType: [
        {
          coding: [{ system: 'http://hl7.org/fhir/resource-types', code: 'Task' }],
        },
      ],
      payloadMimeType: ['application/fhir+json', 'application/fhir+xml'],
      address: endpoint.address,
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
        id: parentUuid,
        meta: resourceMeta(PROFILE_ORG_PARENT),
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

    // Emit one <code> block per stored role (DIC, DMS, HRP, ...). DSF
    // tooling expects multiple <code> entries with single coding inside —
    // NOT one <code> with multiple codings. Fallback to 'DIC' so the
    // affiliation always carries at least one valid role.
    const roles = readRoles(ms.roles);
    const codeBlocks = (roles.length > 0 ? roles : ['DIC']).map((role) => ({
      coding: [{ system: ORG_ROLE_SYSTEM, code: role }],
    }));
    entries.push({
      fullUrl: `urn:uuid:${affUuid}`,
      resource: {
        resourceType: 'OrganizationAffiliation',
        id: affUuid,
        meta: resourceMeta(PROFILE_AFFILIATION),
        organization: { reference: `urn:uuid:${parentUuid}`, type: 'Organization' },
        participatingOrganization: { reference: `urn:uuid:${orgUuid}`, type: 'Organization' },
        code: codeBlocks,
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
    meta: BUNDLE_META,
    entry: entries,
  };
}

/**
 * Generate a full allow list bundle containing ALL organizations, endpoints, and affiliations.
 * Used for the global bundle download (not scoped to a single instance).
 */
/**
 * Generate the network-wide DSF Allow-List bundle.
 * Mirrors upstream dsf-process-allow-list/UpdateAllowList.java:
 * - Only APPROVED + active organizations.
 * - Each Organization carries cert thumbprints as extensions.
 * - All endpoints of each org included.
 * - All OrganizationAffiliations included.
 * - Parent verbund Organizations (MII/NUM/…) referenced by affiliations are also generated.
 *
 * The receiving DSF FHIR server installs this bundle as its local allow-list so
 * mTLS handshakes can verify peers by thumbprint match.
 */
export async function generateFullBundle(): Promise<object> {
  // Only orgs whose LATEST approval_request (by created_at) is 'APPROVED' AND active.
  // Using a correlated subquery so a newer REJECTED/PENDING entry supersedes an old APPROVED.
  const orgs = await db('organizations').where({ active: true }).whereRaw(`(
      SELECT status FROM approval_requests
      WHERE instance_id = organizations.instance_id
      ORDER BY created_at DESC LIMIT 1
    ) = 'APPROVED'`);

  const orgUuids: Record<string, string> = {};
  const epUuids: Record<string, string> = {};
  for (const org of orgs) orgUuids[org.identifier] = uuidv4();

  // Collect all parent verbunds referenced in memberships of approved orgs.
  const memberships = await db('memberships')
    .whereIn(
      'organization_id',
      orgs.map((o: { identifier: string }) => o.identifier),
    )
    .whereNull('deleted_at');
  const parentIdentifiers = Array.from(
    new Set(memberships.map((m: { parent_organization: string }) => m.parent_organization)),
  );

  // Generate UUIDs for parent verbunds.
  // Reuse if the parent IS itself in our approved-orgs list.
  const parentUuids: Record<string, string> = {};
  for (const pid of parentIdentifiers) {
    parentUuids[pid] = orgUuids[pid] ?? uuidv4();
  }

  // Batch-load endpoints + certificates for ALL approved orgs in two queries.
  // Previously this loop ran two queries per org (60 round-trips for 30 orgs).
  const approvedOrgIds = orgs.map((o: { identifier: string }) => o.identifier);
  const allEndpoints = approvedOrgIds.length
    ? await db('endpoints').whereIn('organization_id', approvedOrgIds)
    : [];
  const allCerts = approvedOrgIds.length
    ? await db('certificates').whereIn('organization_id', approvedOrgIds)
    : [];

  const endpointsByOrg = new Map<string, any[]>();
  for (const ep of allEndpoints) {
    const list = endpointsByOrg.get(ep.organization_id) ?? [];
    list.push(ep);
    endpointsByOrg.set(ep.organization_id, list);
  }
  const certsByOrg = new Map<string, any[]>();
  for (const c of allCerts) {
    const list = certsByOrg.get(c.organization_id) ?? [];
    list.push(c);
    certsByOrg.set(c.organization_id, list);
  }

  const entries: object[] = [];

  // Approved member organizations + their endpoints.
  for (const org of orgs) {
    const orgUuid = orgUuids[org.identifier];
    const endpoints = endpointsByOrg.get(org.identifier) ?? [];
    const certs = certsByOrg.get(org.identifier) ?? [];

    for (const ep of endpoints) {
      epUuids[`${org.identifier}/${ep.identifier}`] = uuidv4();
    }

    // FHIR R4: extension must be absent or non-empty — never []. Omit the key
    // entirely when the org has no certificate thumbprints.
    const orgCertExtensions = certs.map((c: { thumbprint: string }) => ({
      url: 'http://dsf.dev/fhir/StructureDefinition/extension-certificate-thumbprint',
      valueString: c.thumbprint,
    }));
    entries.push({
      fullUrl: `urn:uuid:${orgUuid}`,
      resource: {
        resourceType: 'Organization',
        id: orgUuid,
        meta: resourceMeta(PROFILE_ORG),
        ...(orgCertExtensions.length ? { extension: orgCertExtensions } : {}),
        identifier: [{ system: ORG_ID_SYSTEM, value: org.identifier }],
        active: true,
        name: org.name,
        endpoint: endpoints.map((ep: { identifier: string }) => ({
          reference: `urn:uuid:${epUuids[`${org.identifier}/${ep.identifier}`]}`,
          type: 'Endpoint',
        })),
      },
      request: { method: 'PUT', url: `Organization?identifier=${ORG_ID_SYSTEM}|${org.identifier}` },
    });

    for (const ep of endpoints) {
      // Same DSF Endpoint shape as in generateBundle — see comment there.
      entries.push({
        fullUrl: `urn:uuid:${epUuids[`${org.identifier}/${ep.identifier}`]}`,
        resource: {
          resourceType: 'Endpoint',
          id: epUuids[`${org.identifier}/${ep.identifier}`],
          meta: resourceMeta(PROFILE_ENDPOINT),
          identifier: [{ system: EP_ID_SYSTEM, value: ep.identifier }],
          status: 'active',
          connectionType: {
            system: 'http://terminology.hl7.org/CodeSystem/endpoint-connection-type',
            code: 'hl7-fhir-rest',
          },
          name: ep.name || `DSF Endpoint for ${ep.identifier}`,
          managingOrganization: { reference: `urn:uuid:${orgUuid}`, type: 'Organization' },
          payloadType: [
            {
              coding: [{ system: 'http://hl7.org/fhir/resource-types', code: 'Task' }],
            },
          ],
          payloadMimeType: ['application/fhir+json', 'application/fhir+xml'],
          address: ep.address,
        },
        request: { method: 'PUT', url: `Endpoint?identifier=${EP_ID_SYSTEM}|${ep.identifier}` },
      });
    }
  }

  // Parent verbund Organizations (MII, NUM, ...) — only if not already an approved member org.
  for (const pid of parentIdentifiers) {
    if (orgUuids[pid]) continue;
    const parentUuid = parentUuids[pid];
    const parentRow = await db('organizations').where({ identifier: pid }).first();
    entries.push({
      fullUrl: `urn:uuid:${parentUuid}`,
      resource: {
        resourceType: 'Organization',
        id: parentUuid,
        meta: resourceMeta(PROFILE_ORG_PARENT),
        identifier: [{ system: ORG_ID_SYSTEM, value: pid }],
        active: true,
        name: parentRow?.name || pid,
      },
      request: { method: 'PUT', url: `Organization?identifier=${ORG_ID_SYSTEM}|${pid}` },
    });
  }

  // OrganizationAffiliations: only those whose endpoint resolves to an emitted endpoint.
  for (const ms of memberships) {
    const memberOrgUuid = orgUuids[ms.organization_id as string];
    const parentUuid = parentUuids[ms.parent_organization as string];
    const epUuid = epUuids[`${ms.organization_id as string}/${ms.endpoint_id as string}`];
    if (!memberOrgUuid || !parentUuid || !epUuid) continue;

    // See note in generateBundle: one <code> per stored role, DSF role system.
    const roles = readRoles(ms.roles);
    const codeBlocks = (roles.length > 0 ? roles : ['DIC']).map((role) => ({
      coding: [{ system: ORG_ROLE_SYSTEM, code: role }],
    }));
    const affUuid = uuidv4();
    entries.push({
      fullUrl: `urn:uuid:${affUuid}`,
      resource: {
        resourceType: 'OrganizationAffiliation',
        id: affUuid,
        meta: resourceMeta(PROFILE_AFFILIATION),
        organization: { reference: `urn:uuid:${parentUuid}`, type: 'Organization' },
        participatingOrganization: { reference: `urn:uuid:${memberOrgUuid}`, type: 'Organization' },
        code: codeBlocks,
        endpoint: [{ reference: `urn:uuid:${epUuid}`, type: 'Endpoint' }],
      },
      request: {
        method: 'PUT',
        url: `OrganizationAffiliation?primary-organization:identifier=${ORG_ID_SYSTEM}|${ms.parent_organization}&participating-organization:identifier=${ORG_ID_SYSTEM}|${ms.organization_id}&endpoint:identifier=${EP_ID_SYSTEM}|${ms.endpoint_id}`,
      },
    });
  }

  // Federation-safe: emit DELETE OrganizationAffiliation for memberships that
  // have been soft-deleted (admin removed the membership in the UI). Tool
  // never emits DELETE for Organization/Endpoint — those records may still be
  // in another tool's allow-list.
  const softDeletedMs = await db('memberships')
    .whereIn(
      'organization_id',
      orgs.map((o: { identifier: string }) => o.identifier),
    )
    .whereNotNull('deleted_at');

  for (const ms of softDeletedMs) {
    entries.push({
      fullUrl: `urn:uuid:${uuidv4()}`,
      request: {
        method: 'DELETE',
        url: `OrganizationAffiliation?primary-organization:identifier=${ORG_ID_SYSTEM}|${ms.parent_organization}&participating-organization:identifier=${ORG_ID_SYSTEM}|${ms.organization_id}&endpoint:identifier=${EP_ID_SYSTEM}|${ms.endpoint_id}`,
      },
    });
  }

  return {
    resourceType: 'Bundle',
    type: 'transaction',
    meta: BUNDLE_META,
    entry: entries,
  };
}
