/**
 * marketplace-sync.service.ts – Refresh GitHub metadata for marketplace_entries.
 * Daily cron at 10:00 UTC; also called synchronously on add.
 */
import { db } from '../db/connection';
import { logger } from '../lib/logger';
import { parseManifest, type DsfManifest } from '../schemas/marketplace-manifest.schema';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const SLEEP_BETWEEN_MS = 1500;

interface RepoResp {
  description: string | null;
  stargazers_count: number;
  license: { spdx_id: string | null } | null;
  topics?: string[];
  forks_count?: number;
  open_issues_count?: number;
  archived?: boolean;
  homepage?: string | null;
  language?: string | null;
  default_branch?: string;
}
interface ReleaseResp {
  tag_name: string;
}
interface CommitResp {
  commit: { committer: { date: string } };
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dsf-mgmt-portal',
  };
  if (GITHUB_TOKEN) h['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

async function ghJson<T>(url: string): Promise<T | null> {
  // Bound every GitHub call so a hung connection can't block the admin add
  // request or stall the daily cron indefinitely. An abort surfaces as an
  // AbortError and falls through to syncEntry's generic error path.
  const r = await fetch(url, { headers: ghHeaders(), signal: AbortSignal.timeout(10000) });
  if (r.status === 404) throw new Error('NOT_FOUND');
  if (r.status === 403 || r.status === 429) throw new Error('RATE_LIMIT');
  if (!r.ok) throw new Error(`HTTP_${r.status}`);
  return (await r.json()) as T;
}

function parseOwnerRepo(gitUrl: string): { owner: string; repo: string } | null {
  const m = gitUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

type ManifestFetch =
  | { kind: 'absent' }
  | { kind: 'parsed'; data: DsfManifest }
  | { kind: 'error'; error: string };

// Fetch and parse the optional dsf-marketplace.json from the repo's raw content
// host. This is intentionally self-contained: a missing file (404) is a normal,
// silent outcome, and any network/HTTP/parse failure is mapped to an error
// result so the caller never has to let it abort the wider sync.
async function fetchManifest(owner: string, repo: string, branch: string): Promise<ManifestFetch> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/dsf-marketplace.json`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (r.status === 404) return { kind: 'absent' };
    if (!r.ok) return { kind: 'error', error: `manifest HTTP ${r.status}` };
    const body = await r.json();
    const result = parseManifest(body);
    if (!result.ok) return { kind: 'error', error: result.error };
    return { kind: 'parsed', data: result.data };
  } catch (err: any) {
    return { kind: 'error', error: `manifest fetch failed: ${err?.message || 'unknown'}` };
  }
}

export async function syncEntry(id: string): Promise<void> {
  const row = await db('marketplace_entries').where({ id }).first();
  if (!row) return;
  const parsed = parseOwnerRepo(row.git_url);
  if (!parsed) {
    await db('marketplace_entries')
      .where({ id })
      .update({ sync_error: 'invalid url', updated_at: new Date() });
    return;
  }
  const { owner, repo } = parsed;
  const base = `https://api.github.com/repos/${owner}/${repo}`;

  try {
    const main = await ghJson<RepoResp>(base);
    if (!main) throw new Error('EMPTY');
    let latestTag: string | null = null;
    try {
      const rel = await ghJson<ReleaseResp>(`${base}/releases/latest`);
      latestTag = rel?.tag_name || null;
    } catch (err: any) {
      if (err.message !== 'NOT_FOUND') throw err;
    }
    let lastCommitAt: Date | null = null;
    try {
      const commits = await ghJson<CommitResp[]>(`${base}/commits?per_page=1`);
      if (commits && commits[0]) {
        const parsed = new Date(commits[0].commit.committer.date);
        // Only persist a real date; a malformed committer date must not write
        // an Invalid Date into last_commit_at.
        if (!Number.isNaN(parsed.getTime())) lastCommitAt = parsed;
      }
    } catch (err: any) {
      if (err.message !== 'NOT_FOUND') throw err;
    }

    // Parse the optional manifest. The no-clobber invariant: a MANUAL row is
    // admin-curated, so its DSF columns and metadata_source are never touched
    // here regardless of what the manifest says. For a non-MANUAL row a parsed
    // manifest takes ownership (metadata_source=MANIFEST) and a parse/fetch
    // failure is surfaced via manifest_error; an absent manifest is silent.
    const manifestUpdate: Record<string, unknown> = {};
    if (row.metadata_source !== 'MANUAL') {
      const manifest = await fetchManifest(owner, repo, main.default_branch || 'main');
      if (manifest.kind === 'parsed') {
        const m = manifest.data;
        manifestUpdate.process_identifiers = JSON.stringify(m.processIdentifiers ?? []);
        manifestUpdate.dsf_version_min = m.dsfVersionMin ?? null;
        manifestUpdate.required_roles = JSON.stringify(m.requiredRoles ?? []);
        manifestUpdate.message_names = JSON.stringify(m.messageNames ?? []);
        manifestUpdate.artifact_url = m.artifactUrl ?? null;
        manifestUpdate.metadata_source = 'MANIFEST';
        manifestUpdate.manifest_error = null;
      } else if (manifest.kind === 'error') {
        manifestUpdate.manifest_error = manifest.error;
      }
      // 'absent' leaves DSF fields and metadata_source untouched (silent).
    }

    await db('marketplace_entries')
      .where({ id })
      .update({
        description: main.description,
        stars: main.stargazers_count,
        license: main.license?.spdx_id || null,
        topics: JSON.stringify(main.topics ?? []),
        forks: main.forks_count ?? 0,
        open_issues: main.open_issues_count ?? 0,
        archived: main.archived ? 1 : 0,
        homepage: main.homepage && main.homepage.trim() ? main.homepage.trim() : null,
        language: main.language ?? null,
        latest_release_tag: latestTag,
        last_commit_at: lastCommitAt,
        ...manifestUpdate,
        sync_at: new Date(),
        sync_error: null,
        updated_at: new Date(),
      });
  } catch (err: any) {
    // A rate limit is transient and not a fault of this entry, so leave its
    // sync_error untouched and let the caller stop the batch.
    if (err.message === 'RATE_LIMIT') throw err;
    const message =
      err.message === 'NOT_FOUND'
        ? 'repository not found'
        : `sync failed: ${err.message || 'unknown'}`;
    await db('marketplace_entries').where({ id }).update({
      sync_error: message,
      updated_at: new Date(),
    });
  }
}

export async function syncAll(): Promise<{ ok: number; failed: number; rateLimited: boolean }> {
  const rows = await db('marketplace_entries').select('id');
  let ok = 0,
    failed = 0;
  let rateLimited = false;
  for (const r of rows) {
    try {
      await syncEntry(r.id);
      ok += 1;
    } catch (err: any) {
      // A rate limit stops the batch; the throttled entry is neither ok nor
      // failed (it was never really attempted), so it is left uncounted.
      if (err.message === 'RATE_LIMIT') {
        rateLimited = true;
        logger.warn('marketplace sync hit rate limit; aborting batch');
        break;
      }
      failed += 1;
    }
    await new Promise((res) => setTimeout(res, SLEEP_BETWEEN_MS));
  }
  logger.info({ ok, failed, rateLimited }, 'marketplace sync complete');
  return { ok, failed, rateLimited };
}
