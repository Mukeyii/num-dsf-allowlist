/**
 * parseSnapshot.ts — Snapshot payload type + tolerant parser for the admin
 * approval request card. Extracted from RequestCard.tsx (project 500-line file
 * limit). Pure data: no React, no side effects.
 */
export interface SnapshotData {
  organization?: {
    name?: string;
    identifier?: string;
    email?: string;
    city?: string;
    country_code?: string;
    active?: boolean;
    address_line?: string;
    postal_code?: string;
  };
  endpoints?: Array<{
    identifier?: string;
    address?: string;
    name?: string;
    ips?: Array<{ ip: string; is_fhir?: boolean; is_bpe?: boolean }>;
  }>;
  certificates?: Array<{ subject?: string; thumbprint?: string; valid_until?: string }>;
  memberships?: Array<{ parent_organization?: string; roles?: string[]; endpoint_id?: string }>;
  contacts?: Array<{ name?: string; email?: string; types?: string[] }>;
}

export function parseSnapshot(raw: string | object | null | undefined): SnapshotData {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as SnapshotData;
  try {
    return JSON.parse(raw as string) as SnapshotData;
  } catch {
    return {};
  }
}
