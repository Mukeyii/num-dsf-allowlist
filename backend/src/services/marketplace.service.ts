/**
 * marketplace.service.ts – CRUD for marketplace_entries.
 * Sync (GitHub metadata) lives in marketplace-sync.service.ts.
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { normalizeGithubUrl, slugify } from '../schemas/marketplace.schema';
import { isLicenseOsi, isStale } from '../lib/marketplaceDerived';
import { writeAuditLog } from './audit.service';

export type MarketplaceStatus = 'APPROVED' | 'EXPERIMENTAL' | 'DEPRECATED';
export type MetadataSource = 'MANIFEST' | 'MANUAL';
export type AdvisorySeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface MarketplaceEntry {
  id: string;
  slug: string | null;
  gitUrl: string;
  name: string;
  description: string | null;
  status: MarketplaceStatus;
  latestReleaseTag: string | null;
  lastCommitAt: Date | null;
  stars: number;
  license: string | null;
  topics: string[];
  forks: number;
  openIssues: number;
  archived: boolean;
  homepage: string | null;
  language: string | null;
  processIdentifiers: string[];
  dsfVersionMin: string | null;
  requiredRoles: string[];
  messageNames: string[];
  artifactUrl: string | null;
  metadataSource: MetadataSource;
  verified: boolean;
  advisoryText: string | null;
  advisorySeverity: AdvisorySeverity | null;
  supersededBy: string | null;
  licenseOk: boolean;
  stale: boolean;
  syncAt: Date | null;
  syncError: string | null;
}

// Parse a JSON-array column defensively into string[]; a malformed value (a
// hand-edited row, a legacy NULL) degrades to an empty list rather than throwing.
function parseStringArray(value: unknown): string[] {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed))
      return parsed.filter((x: unknown): x is string => typeof x === 'string');
  } catch {
    /* fall through to [] */
  }
  return [];
}

function rowToEntry(r: any): MarketplaceEntry {
  return {
    id: r.id,
    slug: r.slug ?? null,
    gitUrl: r.git_url,
    name: r.name,
    description: r.description,
    status: r.status,
    latestReleaseTag: r.latest_release_tag,
    lastCommitAt: r.last_commit_at,
    stars: r.stars,
    license: r.license,
    topics: parseStringArray(r.topics),
    forks: Number(r.forks) || 0,
    openIssues: Number(r.open_issues) || 0,
    archived: !!r.archived,
    homepage: r.homepage || null,
    language: r.language || null,
    processIdentifiers: parseStringArray(r.process_identifiers),
    dsfVersionMin: r.dsf_version_min ?? null,
    requiredRoles: parseStringArray(r.required_roles),
    messageNames: parseStringArray(r.message_names),
    artifactUrl: r.artifact_url ?? null,
    metadataSource: r.metadata_source,
    verified: !!r.verified,
    advisoryText: r.advisory_text ?? null,
    advisorySeverity: r.advisory_severity ?? null,
    supersededBy: r.superseded_by ?? null,
    licenseOk: isLicenseOsi(r.license),
    stale: isStale(!!r.archived, r.last_commit_at, new Date()),
    syncAt: r.sync_at,
    syncError: r.sync_error,
  };
}

export async function listEntries(): Promise<MarketplaceEntry[]> {
  const rows = await db('marketplace_entries').select('*').orderBy('name', 'asc');
  return rows.map(rowToEntry);
}

export async function addEntry(
  data: { gitUrl: string; status: MarketplaceStatus },
  adminEmail: string,
  ip: string,
): Promise<MarketplaceEntry> {
  const { canonical, owner, repo } = normalizeGithubUrl(data.gitUrl);
  const existing = await db('marketplace_entries').where({ git_url: canonical }).first();
  if (existing) throw new Error('ALREADY_EXISTS');

  const id = uuidv4();
  const now = new Date();
  await db('marketplace_entries').insert({
    id,
    slug: slugify(owner, repo),
    git_url: canonical,
    name: repo,
    description: null,
    status: data.status,
    stars: 0,
    metadata_source: 'MANUAL',
    added_by: adminEmail,
    added_at: now,
    updated_at: now,
  });

  await writeAuditLog({
    userEmail: adminEmail,
    resourceType: 'MARKETPLACE',
    resourceId: id,
    operation: 'CREATE',
    diffJson: { gitUrl: canonical, status: data.status },
    ipAddress: ip,
  });

  // First sync runs synchronously so the response includes metadata.
  const { syncEntry } = await import('./marketplace-sync.service');
  try {
    await syncEntry(id);
  } catch {
    /* sync failure stays in sync_error column */
  }

  const row = await db('marketplace_entries').where({ id }).first();
  return rowToEntry(row);
}

export async function updateStatus(
  id: string,
  status: MarketplaceStatus,
  adminEmail: string,
  ip: string,
): Promise<MarketplaceEntry> {
  const existing = await db('marketplace_entries').where({ id }).first();
  if (!existing) throw new Error('NOT_FOUND');
  await db('marketplace_entries').where({ id }).update({ status, updated_at: new Date() });
  await writeAuditLog({
    userEmail: adminEmail,
    resourceType: 'MARKETPLACE',
    resourceId: id,
    operation: 'UPDATE',
    diffJson: { before: { status: existing.status }, after: { status } },
    ipAddress: ip,
  });
  const row = await db('marketplace_entries').where({ id }).first();
  return rowToEntry(row);
}

export async function removeEntry(id: string, adminEmail: string, ip: string): Promise<void> {
  const existing = await db('marketplace_entries').where({ id }).first();
  if (!existing) throw new Error('NOT_FOUND');
  await db('marketplace_entries').where({ id }).delete();
  await writeAuditLog({
    userEmail: adminEmail,
    resourceType: 'MARKETPLACE',
    resourceId: id,
    operation: 'DELETE',
    diffJson: { gitUrl: existing.git_url },
    ipAddress: ip,
  });
}
