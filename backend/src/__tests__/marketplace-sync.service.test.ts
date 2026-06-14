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
