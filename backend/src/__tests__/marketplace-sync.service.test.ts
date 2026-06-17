/**
 * marketplace-sync.service.test.ts – Offline tests for the GitHub-sync paths.
 * The only network boundary is the global `fetch` in ghJson(); we replace it
 * so NO real HTTP happens.
 *
 * SAFE paths covered:
 *  - syncEntry on a GitHub 403 (rate limit): rethrows RATE_LIMIT and leaves
 *    sync_error untouched (a rate limit is transient, not an entry fault).
 *  - syncEntry on a GitHub 404: records sync_error and resolves.
 *  - syncAll over the seeded set: catches the rate-limit, breaks the batch,
 *    flags rateLimited and does NOT count the throttled entry as failed.
 *
 * We seed one controlled marketplace_entries row (unique git_url) and clean it
 * up afterwards.
 *
 * Dependencies: db/connection, marketplace-sync.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { syncEntry, syncAll } from '../services/marketplace-sync.service';

const realFetch = global.fetch;

describe('marketplace-sync.service – offline sync paths', () => {
  const stamp = Date.now();
  const id = uuidv4();
  const gitUrl = `https://github.com/dsf-test/mp-sync-${stamp}`;

  beforeAll(async () => {
    await db('marketplace_entries').insert({
      id,
      name: `mp-sync-${stamp}`,
      git_url: gitUrl,
      status: 'EXPERIMENTAL',
      added_by: `mp-sync-test-${stamp}@example.de`,
      added_at: new Date(),
      updated_at: new Date(),
    });
  });

  afterAll(async () => {
    global.fetch = realFetch;
    await db('marketplace_entries').where({ id }).del();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('syncEntry rethrows on a GitHub rate limit (403) and leaves sync_error untouched', async () => {
    // Seed a sentinel so we can prove the rate-limit path does not overwrite it.
    await db('marketplace_entries').where({ id }).update({ sync_error: 'sentinel' });

    // Every GitHub call returns 403 → service throws RATE_LIMIT internally.
    global.fetch = (async () => ({
      status: 403,
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(syncEntry(id)).rejects.toThrow('RATE_LIMIT');

    const row = await db('marketplace_entries').where({ id }).first();
    // Transient throttling must NOT be recorded as a per-entry sync error.
    expect(row.sync_error).toBe('sentinel');
  });

  it('syncEntry records sync_error and resolves on a GitHub 404', async () => {
    global.fetch = (async () => ({
      status: 404,
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(syncEntry(id)).resolves.toBeUndefined();

    const row = await db('marketplace_entries').where({ id }).first();
    expect(row.sync_error).toBe('repository not found');
  });

  it('syncAll handles a rate limit gracefully — flags it and does not count it as failed', async () => {
    global.fetch = (async () => ({
      status: 403,
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    // Must resolve (not reject) even though a sync hit the rate limit.
    const result = await syncAll();
    expect(result).toEqual(
      expect.objectContaining({
        ok: expect.any(Number),
        failed: expect.any(Number),
        rateLimited: true,
      }),
    );
    // The throttled entry is neither ok nor failed — it stops the batch.
    expect(result.failed).toBe(0);
  });
});

/**
 * A repo response that always succeeds; the per-URL mock layers releases,
 * commits and the manifest on top. default_branch drives the raw manifest URL.
 */
function repoBody(over: Record<string, unknown> = {}) {
  return {
    description: 'desc',
    stargazers_count: 1,
    license: { spdx_id: 'MIT' },
    topics: [],
    forks_count: 0,
    open_issues_count: 0,
    archived: false,
    homepage: null,
    language: 'Java',
    default_branch: 'main',
    ...over,
  };
}

const okJson = (body: unknown) => ({ status: 200, ok: true, json: async () => body });
const notFound = () => ({ status: 404, ok: false, json: async () => ({}) });

// A JSON column reads back either as a JSON string or as an already-parsed
// array depending on the driver; normalize so assertions don't depend on it.
function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try {
      const p = JSON.parse(value);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Build a fetch double that dispatches by URL. `manifest` controls the
 * raw.githubusercontent.com response: 'absent' → 404, 'badJson' → json()
 * rejects, otherwise the object is served as the manifest body. `releases`
 * is the list returned for `releases?per_page=10`.
 */
function mockGithub(opts: {
  repo?: Record<string, unknown>;
  manifest?: 'absent' | 'badJson' | Record<string, unknown>;
  releases?: Array<{ tag_name: string; published_at: string | null }>;
}) {
  return (async (url: string) => {
    if (url.startsWith('https://raw.githubusercontent.com/')) {
      if (opts.manifest === undefined || opts.manifest === 'absent') return notFound();
      if (opts.manifest === 'badJson')
        return {
          status: 200,
          ok: true,
          json: async () => {
            throw new SyntaxError('Unexpected token');
          },
        };
      return okJson(opts.manifest);
    }
    if (url.includes('/releases/latest')) return notFound();
    if (url.includes('/releases?per_page=10')) return okJson(opts.releases ?? []);
    if (url.includes('/commits?per_page=1')) return okJson([]);
    // The bare repo endpoint.
    return okJson(repoBody(opts.repo));
  }) as unknown as typeof fetch;
}

describe('marketplace-sync.service – manifest parsing (no-clobber)', () => {
  const stamp = Date.now();
  const id = uuidv4();
  const gitUrl = `https://github.com/dsf-test/mp-manifest-${stamp}`;

  beforeAll(async () => {
    await db('marketplace_entries').insert({
      id,
      name: `mp-manifest-${stamp}`,
      git_url: gitUrl,
      status: 'EXPERIMENTAL',
      metadata_source: 'MANUAL', // reset per test as needed
      added_by: `mp-manifest-${stamp}@example.de`,
      added_at: new Date(),
      updated_at: new Date(),
    });
  });

  afterAll(async () => {
    global.fetch = realFetch;
    await db('marketplace_releases').where({ entry_id: id }).del();
    await db('marketplace_entries').where({ id }).del();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('applies a valid manifest and sets metadata_source=MANIFEST', async () => {
    await db('marketplace_entries').where({ id }).update({
      metadata_source: 'MANUAL',
      process_identifiers: null,
      dsf_version_min: null,
      manifest_error: 'stale error',
    });
    // Start from a non-MANUAL row so the manifest is allowed to write.
    await db('marketplace_entries').where({ id }).update({ metadata_source: 'MANIFEST' });

    global.fetch = mockGithub({
      manifest: {
        processIdentifiers: ['dsfdev_helloWorld'],
        dsfVersionMin: '1.5.0',
        requiredRoles: ['DIC', 'HRP'],
      },
    });

    await syncEntry(id);

    const row = await db('marketplace_entries').where({ id }).first();
    expect(row.metadata_source).toBe('MANIFEST');
    expect(asArray(row.process_identifiers)).toEqual(['dsfdev_helloWorld']);
    expect(row.dsf_version_min).toBe('1.5.0');
    expect(asArray(row.required_roles)).toEqual(['DIC', 'HRP']);
    expect(row.manifest_error).toBeNull();
  });

  it('does NOT overwrite DSF fields when the row is already MANUAL', async () => {
    await db('marketplace_entries')
      .where({ id })
      .update({
        metadata_source: 'MANUAL',
        process_identifiers: JSON.stringify(['admin_curated']),
        dsf_version_min: '9.9.9',
        manifest_error: null,
      });

    global.fetch = mockGithub({
      manifest: {
        processIdentifiers: ['from_manifest'],
        dsfVersionMin: '1.0.0',
      },
    });

    await syncEntry(id);

    const row = await db('marketplace_entries').where({ id }).first();
    // The admin-curated values survive; the manifest is ignored for these columns.
    expect(row.metadata_source).toBe('MANUAL');
    expect(asArray(row.process_identifiers)).toEqual(['admin_curated']);
    expect(row.dsf_version_min).toBe('9.9.9');
  });

  it('sets manifest_error and leaves DSF fields unchanged on a malformed manifest', async () => {
    await db('marketplace_entries')
      .where({ id })
      .update({
        metadata_source: 'MANIFEST',
        process_identifiers: JSON.stringify(['keep_me']),
        dsf_version_min: '2.0.0',
        manifest_error: null,
      });

    global.fetch = mockGithub({ manifest: 'badJson' });

    await syncEntry(id);

    const row = await db('marketplace_entries').where({ id }).first();
    expect(row.manifest_error).toBeTruthy();
    // DSF fields untouched by a parse failure.
    expect(asArray(row.process_identifiers)).toEqual(['keep_me']);
    expect(row.dsf_version_min).toBe('2.0.0');
  });

  it('leaves DSF fields and metadata_source unchanged on an absent (404) manifest', async () => {
    await db('marketplace_entries')
      .where({ id })
      .update({
        metadata_source: 'MANIFEST',
        process_identifiers: JSON.stringify(['untouched']),
        dsf_version_min: '3.0.0',
        manifest_error: null,
      });

    global.fetch = mockGithub({ manifest: 'absent' });

    await syncEntry(id);

    const row = await db('marketplace_entries').where({ id }).first();
    expect(row.metadata_source).toBe('MANIFEST');
    expect(asArray(row.process_identifiers)).toEqual(['untouched']);
    expect(row.dsf_version_min).toBe('3.0.0');
    // An absent manifest is not an error.
    expect(row.manifest_error).toBeNull();
  });
});
