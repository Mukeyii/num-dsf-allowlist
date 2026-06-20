/**
 * marketplace.service.ts – CRUD for marketplace_entries.
 * Sync (GitHub metadata) lives in marketplace-sync.service.ts.
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { normalizeGithubUrl, slugify } from '../schemas/marketplace.schema';
import { isLicenseOsi, isStale } from '../lib/marketplaceDerived';
import { parseJsonStringArray as parseStringArray } from '../lib/jsonColumn';
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

export interface MarketplaceRelease {
  tag: string;
  publishedAt: Date | null;
}

export interface MarketplaceEntryDetail extends MarketplaceEntry {
  releases: MarketplaceRelease[];
}

// DSF fields the manifest sync owns; editing any of them makes the entry
// admin-curated (metadata_source = MANUAL) so a later sync can't clobber it.
const DSF_META_FIELDS = [
  'processIdentifiers',
  'dsfVersionMin',
  'requiredRoles',
  'messageNames',
  'artifactUrl',
] as const;

export interface UpdateMetaFields {
  status?: MarketplaceStatus;
  verified?: boolean;
  advisoryText?: string | null;
  advisorySeverity?: AdvisorySeverity | null;
  supersededBy?: string | null;
  processIdentifiers?: string[];
  dsfVersionMin?: string | null;
  requiredRoles?: string[];
  messageNames?: string[];
  artifactUrl?: string | null;
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

export async function getEntryBySlug(slug: string): Promise<MarketplaceEntryDetail | null> {
  const row = await db('marketplace_entries').where({ slug }).first();
  if (!row) return null;
  const releaseRows = await db('marketplace_releases')
    .where({ entry_id: row.id })
    .orderBy('published_at', 'desc');
  const releases: MarketplaceRelease[] = releaseRows.map((r: any) => ({
    tag: r.tag,
    publishedAt: r.published_at ?? null,
  }));
  return { ...rowToEntry(row), releases };
}

export async function updateMeta(
  id: string,
  fields: UpdateMetaFields,
  adminEmail: string,
  ip: string,
): Promise<MarketplaceEntry> {
  const existing = await db('marketplace_entries').where({ id }).first();
  if (!existing) throw new Error('NOT_FOUND');

  // Build a partial update from only the provided fields; an absent key is left
  // untouched, while an explicit null clears the column.
  const update: Record<string, unknown> = { updated_at: new Date() };
  if (fields.status !== undefined) update.status = fields.status;
  if (fields.verified !== undefined) update.verified = fields.verified ? 1 : 0;
  if (fields.advisoryText !== undefined) update.advisory_text = fields.advisoryText;
  if (fields.advisorySeverity !== undefined) update.advisory_severity = fields.advisorySeverity;
  if (fields.supersededBy !== undefined) update.superseded_by = fields.supersededBy;
  if (fields.processIdentifiers !== undefined)
    update.process_identifiers = JSON.stringify(fields.processIdentifiers);
  if (fields.dsfVersionMin !== undefined) update.dsf_version_min = fields.dsfVersionMin;
  if (fields.requiredRoles !== undefined)
    update.required_roles = JSON.stringify(fields.requiredRoles);
  if (fields.messageNames !== undefined) update.message_names = JSON.stringify(fields.messageNames);
  if (fields.artifactUrl !== undefined) update.artifact_url = fields.artifactUrl;

  // Editing any DSF field hands ownership to the admin; the sync no longer
  // overwrites this row's DSF columns (the B3 no-clobber invariant).
  const touchesDsf = DSF_META_FIELDS.some((f) => fields[f] !== undefined);
  if (touchesDsf) update.metadata_source = 'MANUAL';

  await db('marketplace_entries').where({ id }).update(update);

  await writeAuditLog({
    userEmail: adminEmail,
    resourceType: 'MARKETPLACE',
    resourceId: id,
    operation: 'UPDATE',
    diffJson: { fields: Object.keys(fields) },
    ipAddress: ip,
  });

  const row = await db('marketplace_entries').where({ id }).first();
  return rowToEntry(row);
}
