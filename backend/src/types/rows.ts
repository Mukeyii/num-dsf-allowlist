/**
 * rows.ts – Row shapes for the federation read paths (fhir/network/approval).
 * Knex returns `any` for query results, so these interfaces are annotations
 * only: they describe the columns those services actually read, letting us drop
 * `any[]`/`(x: any)` without changing behaviour. They are intentionally minimal
 * — not a full mirror of every table column.
 */

export interface OrganizationRow {
  identifier: string;
  instance_id: string;
  name: string;
  active: boolean | number;
  email: string;
  city?: string | null;
  country_code?: string | null;
}

export interface EndpointRow {
  identifier: string;
  organization_id: string;
  name: string | null;
  address: string;
}

export interface EndpointIpRow {
  endpoint_id: string;
  ip: string;
  is_fhir: boolean | number;
  is_bpe: boolean | number;
}

export interface CertRow {
  organization_id: string;
  thumbprint: string;
  valid_until: Date | string | null;
}

export interface MembershipRow {
  organization_id: string;
  parent_organization: string;
  endpoint_id: string;
  roles: unknown;
}

export interface ContactRow {
  organization_id: string;
  name: string | null;
  email: string;
  phone: string | null;
  types: unknown;
}
