/**
 * network.service.ts – Cross-instance "allow list" view for the map
 * Admins receive full details. Non-admins receive only active/inactive +
 * endpoint names + aggregate cert status — no PII, no IPs, no exact expiry dates.
 * Dependencies: db
 */
import { db } from '../db/connection';

type CertStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NONE';

function safeJsonArray(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function certStatus(validUntils: (Date | string | null)[]): {
  status: CertStatus;
  next: string | null;
  daysUntil: number | null;
} {
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const valid = validUntils
    .filter((v): v is Date | string => v != null)
    .map((v) => new Date(v).getTime())
    .filter((t) => !isNaN(t));
  if (valid.length === 0) return { status: 'NONE', next: null, daysUntil: null };
  const furthest = Math.max(...valid);
  const days = Math.ceil((furthest - now) / (24 * 60 * 60 * 1000));
  if (furthest < now)
    return { status: 'EXPIRED', next: new Date(furthest).toISOString(), daysUntil: days };
  if (furthest - now < THIRTY_DAYS)
    return { status: 'EXPIRING', next: new Date(furthest).toISOString(), daysUntil: days };
  return { status: 'VALID', next: new Date(furthest).toISOString(), daysUntil: days };
}

export async function getNetworkMap(opts: { isAdmin: boolean }) {
  // The federation set MUST match fhir.service.generateFullBundle (the single
  // source of truth): active = true AND the LATEST approval_requests row (by
  // created_at) for the instance is 'APPROVED'. A divergent rule (e.g. ANY
  // APPROVED row) would keep de-approved or deactivated orgs on the map.
  // created_at, id DESC is a deterministic tiebreaker on equal timestamps.
  const approvedRows = await db('organizations')
    .where({ active: true })
    .whereRaw(
      `(
      SELECT status FROM approval_requests
      WHERE instance_id = organizations.instance_id
      ORDER BY created_at DESC, id DESC LIMIT 1
    ) = 'APPROVED'`,
    )
    .select('identifier');
  const approvedOrgIds: string[] = approvedRows.map((r: any) => r.identifier);

  if (approvedOrgIds.length === 0) return { organizations: [] };

  const orgs: any[] = await db('organizations').whereIn('identifier', approvedOrgIds);
  const endpoints: any[] = await db('endpoints').whereIn('organization_id', approvedOrgIds);
  const endpointIds = endpoints.map((e) => e.identifier);
  const endpointIps: any[] =
    endpointIds.length > 0 ? await db('endpoint_ips').whereIn('endpoint_id', endpointIds) : [];
  const contacts: any[] = await db('contacts').whereIn('organization_id', approvedOrgIds);
  const certs: any[] = await db('certificates').whereIn('organization_id', approvedOrgIds);
  const memberships: any[] = await db('memberships').whereIn('organization_id', approvedOrgIds);

  const organizations = orgs.map((org) => {
    const orgCerts = certs.filter((c) => c.organization_id === org.identifier);
    const { status, next, daysUntil } = certStatus(orgCerts.map((c) => c.valid_until));

    const orgEndpointsRaw = endpoints.filter((e) => e.organization_id === org.identifier);
    const orgMembershipsRaw = memberships.filter((m) => m.organization_id === org.identifier);

    const publicEndpoints = orgEndpointsRaw.map((ep) => ({
      identifier: ep.identifier,
      name: ep.name,
    }));
    const publicMemberships = orgMembershipsRaw.map((m) => ({
      parent_organization: m.parent_organization,
      roles: safeJsonArray(m.roles),
    }));

    const base = {
      identifier: org.identifier,
      name: org.name,
      active: !!org.active,
      city: org.city ?? null,
      country_code: org.country_code ?? null,
      cert_status: status,
      endpoints: publicEndpoints,
      memberships: publicMemberships,
    };

    if (!opts.isAdmin) return base;

    const adminEndpoints = orgEndpointsRaw.map((ep) => ({
      identifier: ep.identifier,
      name: ep.name,
      address: ep.address,
      ips: endpointIps
        .filter((ip) => ip.endpoint_id === ep.identifier)
        .map((ip) => ({
          ip: ip.ip,
          is_fhir: !!ip.is_fhir,
          is_bpe: !!ip.is_bpe,
        })),
    }));
    const adminContacts = contacts
      .filter((c) => c.organization_id === org.identifier)
      .map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        types: safeJsonArray(c.types),
      }));
    const adminMemberships = orgMembershipsRaw.map((m) => ({
      parent_organization: m.parent_organization,
      endpoint_id: m.endpoint_id,
      roles: safeJsonArray(m.roles),
    }));

    return {
      ...base,
      email: org.email,
      next_cert_expiry: next,
      cert_days_until: daysUntil,
      endpoints: adminEndpoints,
      contacts: adminContacts,
      memberships: adminMemberships,
      certificates_count: orgCerts.length,
    };
  });

  return { organizations };
}
