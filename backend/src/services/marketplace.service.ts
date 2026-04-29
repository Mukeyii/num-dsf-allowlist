/**
 * marketplace.service.ts – CRUD for marketplace_entries.
 * Sync (GitHub metadata) lives in marketplace-sync.service.ts.
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { normalizeGithubUrl } from '../schemas/marketplace.schema';
import { writeAuditLog } from './audit.service';

export type MarketplaceStatus = 'APPROVED' | 'EXPERIMENTAL' | 'DEPRECATED';

export interface MarketplaceEntry {
  id: string;
  gitUrl: string;
  name: string;
  description: string | null;
  status: MarketplaceStatus;
  latestReleaseTag: string | null;
  lastCommitAt: Date | null;
  stars: number;
  license: string | null;
  syncAt: Date | null;
  syncError: string | null;
}

function rowToEntry(r: any): MarketplaceEntry {
  return {
    id: r.id,
    gitUrl: r.git_url,
    name: r.name,
    description: r.description,
    status: r.status,
    latestReleaseTag: r.latest_release_tag,
    lastCommitAt: r.last_commit_at,
    stars: r.stars,
    license: r.license,
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
  const { canonical, repo } = normalizeGithubUrl(data.gitUrl);
  const existing = await db('marketplace_entries').where({ git_url: canonical }).first();
  if (existing) throw new Error('ALREADY_EXISTS');

  const id = uuidv4();
  const now = new Date();
  await db('marketplace_entries').insert({
    id,
    git_url: canonical,
    name: repo,
    description: null,
    status: data.status,
    stars: 0,
    added_by: adminEmail,
    added_at: now,
    updated_at: now,
  });

  await writeAuditLog({
    userEmail: adminEmail, resourceType: 'MARKETPLACE', resourceId: id,
    operation: 'CREATE', diffJson: { gitUrl: canonical, status: data.status }, ipAddress: ip,
  });

  // First sync runs synchronously so the response includes metadata.
  const { syncEntry } = await import('./marketplace-sync.service');
  try { await syncEntry(id); } catch { /* sync failure stays in sync_error column */ }

  const row = await db('marketplace_entries').where({ id }).first();
  return rowToEntry(row);
}

export async function updateStatus(
  id: string, status: MarketplaceStatus, adminEmail: string, ip: string,
): Promise<MarketplaceEntry> {
  const existing = await db('marketplace_entries').where({ id }).first();
  if (!existing) throw new Error('NOT_FOUND');
  await db('marketplace_entries').where({ id }).update({ status, updated_at: new Date() });
  await writeAuditLog({
    userEmail: adminEmail, resourceType: 'MARKETPLACE', resourceId: id,
    operation: 'UPDATE', diffJson: { before: { status: existing.status }, after: { status } }, ipAddress: ip,
  });
  const row = await db('marketplace_entries').where({ id }).first();
  return rowToEntry(row);
}

export async function removeEntry(id: string, adminEmail: string, ip: string): Promise<void> {
  const existing = await db('marketplace_entries').where({ id }).first();
  if (!existing) throw new Error('NOT_FOUND');
  await db('marketplace_entries').where({ id }).delete();
  await writeAuditLog({
    userEmail: adminEmail, resourceType: 'MARKETPLACE', resourceId: id,
    operation: 'DELETE', diffJson: { gitUrl: existing.git_url }, ipAddress: ip,
  });
}
