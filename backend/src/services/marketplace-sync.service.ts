/**
 * marketplace-sync.service.ts – Refresh GitHub metadata for marketplace_entries.
 * Daily cron at 10:00 UTC; also called synchronously on add.
 */
import { db } from '../db/connection';
import { logger } from '../lib/logger';

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
}
interface ReleaseResp { tag_name: string }
interface CommitResp { commit: { committer: { date: string } } }

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'dsf-mgmt-portal' };
  if (GITHUB_TOKEN) h['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

async function ghJson<T>(url: string): Promise<T | null> {
  const r = await fetch(url, { headers: ghHeaders() });
  if (r.status === 404) throw new Error('NOT_FOUND');
  if (r.status === 403 || r.status === 429) throw new Error('RATE_LIMIT');
  if (!r.ok) throw new Error(`HTTP_${r.status}`);
  return (await r.json()) as T;
}

function parseOwnerRepo(gitUrl: string): { owner: string; repo: string } | null {
  const m = gitUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export async function syncEntry(id: string): Promise<void> {
  const row = await db('marketplace_entries').where({ id }).first();
  if (!row) return;
  const parsed = parseOwnerRepo(row.git_url);
  if (!parsed) {
    await db('marketplace_entries').where({ id }).update({ sync_error: 'invalid url', updated_at: new Date() });
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
      if (commits && commits[0]) lastCommitAt = new Date(commits[0].commit.committer.date);
    } catch (err: any) {
      if (err.message !== 'NOT_FOUND') throw err;
    }

    await db('marketplace_entries').where({ id }).update({
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
      sync_at: new Date(),
      sync_error: null,
      updated_at: new Date(),
    });
  } catch (err: any) {
    const message = err.message === 'NOT_FOUND' ? 'repository not found'
      : err.message === 'RATE_LIMIT' ? 'github rate limit'
      : `sync failed: ${err.message || 'unknown'}`;
    await db('marketplace_entries').where({ id }).update({
      sync_error: message,
      updated_at: new Date(),
    });
    if (err.message === 'RATE_LIMIT') throw err;
  }
}

export async function syncAll(): Promise<{ ok: number; failed: number }> {
  const rows = await db('marketplace_entries').select('id');
  let ok = 0, failed = 0;
  for (const r of rows) {
    try {
      await syncEntry(r.id);
      ok += 1;
    } catch (err: any) {
      failed += 1;
      if (err.message === 'RATE_LIMIT') {
        logger.warn('marketplace sync hit rate limit; aborting batch');
        break;
      }
    }
    await new Promise(res => setTimeout(res, SLEEP_BETWEEN_MS));
  }
  logger.info({ ok, failed }, 'marketplace sync complete');
  return { ok, failed };
}
