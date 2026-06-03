/**
 * marketplace-sync.service.test.ts – Offline tests for the GitHub-sync paths.
 * The only network boundary is the global `fetch` in ghJson(); we replace it
 * so NO real HTTP happens.
 *
 * SAFE paths covered:
 *  - syncEntry on a GitHub 403 (rate limit): writes sync_error and rethrows
 *    RATE_LIMIT (matches the service contract).
 *  - syncAll over the seeded set: catches the rate-limit, breaks the batch and
 *    returns { ok, failed } WITHOUT throwing out.
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

  it('syncEntry writes sync_error and rethrows on a GitHub rate limit (403), no network', async () => {
    // Every GitHub call returns 403 → service throws RATE_LIMIT internally.
    global.fetch = (async () => ({
      status: 403,
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(syncEntry(id)).rejects.toThrow('RATE_LIMIT');

    const row = await db('marketplace_entries').where({ id }).first();
    expect(row.sync_error).toBe('github rate limit');
  });

  it('syncAll handles a rate limit gracefully — returns a result and does not throw', async () => {
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
      }),
    );
    // A rate limit aborts the batch, so at least one entry failed.
    expect(result.failed).toBeGreaterThanOrEqual(1);
  });
});
