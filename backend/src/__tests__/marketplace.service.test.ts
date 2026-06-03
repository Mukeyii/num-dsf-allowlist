/**
 * marketplace.service.test.ts – Service-layer tests for marketplace.service.
 * Exercises listEntries / addEntry / removeEntry against the DB.
 *
 * addEntry runs a first sync synchronously (GitHub metadata). We mock
 * marketplace-sync.service so the test stays fully offline — addEntry still
 * inserts the row first, so the list/delete path is exercised end-to-end.
 *
 * Dependencies: db/connection, marketplace.service
 */

// Hoisted before importing marketplace.service (which dynamic-imports sync).
jest.mock('../services/marketplace-sync.service', () => ({
  syncEntry: jest.fn().mockResolvedValue(undefined),
  syncAll: jest.fn().mockResolvedValue({ ok: 0, failed: 0 }),
}));

import { db } from '../db/connection';
import { listEntries, addEntry, removeEntry } from '../services/marketplace.service';

describe('marketplace.service – add / list / delete', () => {
  const stamp = Date.now();
  const repo = `mp-svc-${stamp}`;
  const gitUrl = `https://github.com/dsf-test/${repo}`;
  const canonical = gitUrl; // normalizeGithubUrl leaves a clean URL untouched
  const admin = `mp-admin-${stamp}@imi.uni-muenster.de`;
  let createdId = '';

  afterAll(async () => {
    try {
      if (createdId) await db('marketplace_entries').where({ id: createdId }).del();
    } finally {
      await db('marketplace_entries').where({ git_url: canonical }).del();
      await db('audit_logs').where({ user_email: admin }).del();
    }
  });

  it('addEntry inserts a new entry and returns its canonical shape', async () => {
    const entry = await addEntry({ gitUrl, status: 'EXPERIMENTAL' }, admin, '127.0.0.1');
    createdId = entry.id;
    expect(entry.gitUrl).toBe(canonical);
    expect(entry.name).toBe(repo);
    expect(entry.status).toBe('EXPERIMENTAL');
    expect(Array.isArray(entry.topics)).toBe(true);
  });

  it('listEntries includes the newly added entry', async () => {
    const all = await listEntries();
    const mine = all.find((e) => e.gitUrl === canonical);
    expect(mine).toBeDefined();
    expect(mine!.id).toBe(createdId);
  });

  it('rejects a duplicate git_url with ALREADY_EXISTS', async () => {
    await expect(addEntry({ gitUrl, status: 'APPROVED' }, admin, '127.0.0.1')).rejects.toThrow(
      'ALREADY_EXISTS',
    );
  });

  it('removeEntry deletes the entry so it no longer appears', async () => {
    await removeEntry(createdId, admin, '127.0.0.1');
    const all = await listEntries();
    expect(all.find((e) => e.id === createdId)).toBeUndefined();
    createdId = ''; // already gone; skip afterAll delete by id
  });
});
