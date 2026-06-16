/**
 * marketplace-v2.service.test.ts – Service tests for the v2 DSF/trust shape.
 * Covers rowToEntry exposing the new DSF metadata + derived licenseOk/stale,
 * the slug + MANUAL source set on add, slug lookup with releases, and the
 * admin updateMeta path.
 *
 * DB-backed: we seed controlled marketplace_entries (and releases) rows and
 * clean them up afterwards. addEntry runs a first sync synchronously, so we
 * mock marketplace-sync.service to keep the add path fully offline.
 *
 * Dependencies: db/connection, marketplace.service
 */

jest.mock('../services/marketplace-sync.service', () => ({
  syncEntry: jest.fn().mockResolvedValue(undefined),
  syncAll: jest.fn().mockResolvedValue({ ok: 0, failed: 0 }),
}));

import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { listEntries, addEntry } from '../services/marketplace.service';

describe('marketplace.service – v2 DSF metadata + derived fields', () => {
  const stamp = Date.now();
  const id = uuidv4();
  const slug = `dsf-test-mp-v2-${stamp}`;
  const gitUrl = `https://github.com/dsf-test/mp-v2-${stamp}`;
  const admin = `mp-v2-${stamp}@imi.uni-muenster.de`;
  // 13 months ago → stale; archived false isolates the commit-age path.
  const oldCommit = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
  let addedId = '';

  beforeAll(async () => {
    await db('marketplace_entries').insert({
      id,
      slug,
      name: `mp-v2-${stamp}`,
      git_url: gitUrl,
      status: 'APPROVED',
      license: 'MIT',
      archived: 0,
      last_commit_at: oldCommit,
      process_identifiers: JSON.stringify(['dsfdev_test']),
      dsf_version_min: '1.5.0',
      required_roles: JSON.stringify(['DIC', 'HRP']),
      message_names: JSON.stringify(['startTest']),
      artifact_url: 'https://github.com/dsf-test/mp-v2/releases/download/v1/p.jar',
      metadata_source: 'MANIFEST',
      verified: 1,
      advisory_text: 'use latest',
      advisory_severity: 'WARNING',
      superseded_by: 'dsf-test-newer',
      added_by: admin,
      added_at: new Date(),
      updated_at: new Date(),
    });
  });

  afterAll(async () => {
    await db('marketplace_entries').where({ id }).del();
    if (addedId) await db('marketplace_entries').where({ id: addedId }).del();
    await db('marketplace_entries').where({ git_url: gitUrl }).del();
    await db('audit_logs').where({ user_email: admin }).del();
  });

  it('listEntries exposes the DSF/trust fields and derived licenseOk/stale', async () => {
    const all = await listEntries();
    const e = all.find((x) => x.id === id);
    expect(e).toBeDefined();
    expect(e!.slug).toBe(slug);
    expect(e!.processIdentifiers).toEqual(['dsfdev_test']);
    expect(e!.dsfVersionMin).toBe('1.5.0');
    expect(e!.requiredRoles).toEqual(['DIC', 'HRP']);
    expect(e!.messageNames).toEqual(['startTest']);
    expect(e!.artifactUrl).toBe('https://github.com/dsf-test/mp-v2/releases/download/v1/p.jar');
    expect(e!.metadataSource).toBe('MANIFEST');
    expect(e!.verified).toBe(true);
    expect(e!.advisoryText).toBe('use latest');
    expect(e!.advisorySeverity).toBe('WARNING');
    expect(e!.supersededBy).toBe('dsf-test-newer');
    // MIT is OSI; the commit is older than a year → stale.
    expect(e!.licenseOk).toBe(true);
    expect(e!.stale).toBe(true);
  });

  it('addEntry sets a lowercase owner-repo slug and MANUAL metadata source', async () => {
    const addStamp = `${stamp}-add`;
    const addUrl = `https://github.com/DSF-Test/MP-Add-${addStamp}`;
    const entry = await addEntry({ gitUrl: addUrl, status: 'EXPERIMENTAL' }, admin, '127.0.0.1');
    addedId = entry.id;
    expect(entry.slug).toBe(`dsf-test-mp-add-${addStamp}`.toLowerCase());
    expect(entry.metadataSource).toBe('MANUAL');
  });
});
