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
import { listEntries, addEntry, getEntryBySlug, updateMeta } from '../services/marketplace.service';

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

describe('marketplace.service – getEntryBySlug + updateMeta', () => {
  const stamp = Date.now();
  const id = uuidv4();
  const slug = `dsf-test-mp-lookup-${stamp}`;
  const gitUrl = `https://github.com/dsf-test/mp-lookup-${stamp}`;
  const admin = `mp-lookup-${stamp}@imi.uni-muenster.de`;
  const relOld = uuidv4();
  const relNew = uuidv4();

  beforeAll(async () => {
    await db('marketplace_entries').insert({
      id,
      slug,
      name: `mp-lookup-${stamp}`,
      git_url: gitUrl,
      status: 'APPROVED',
      metadata_source: 'MANIFEST',
      dsf_version_min: '1.0.0',
      added_by: admin,
      added_at: new Date(),
      updated_at: new Date(),
    });
    await db('marketplace_releases').insert([
      { id: relOld, entry_id: id, tag: 'v1.0.0', published_at: new Date('2024-01-01T00:00:00Z') },
      { id: relNew, entry_id: id, tag: 'v2.0.0', published_at: new Date('2025-01-01T00:00:00Z') },
    ]);
  });

  afterAll(async () => {
    // Releases cascade from the entry, but delete explicitly to be safe.
    await db('marketplace_releases').where({ entry_id: id }).del();
    await db('marketplace_entries').where({ id }).del();
    await db('audit_logs').where({ user_email: admin }).del();
  });

  it('getEntryBySlug returns the entry with releases newest-first', async () => {
    const entry = await getEntryBySlug(slug);
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe(id);
    expect(entry!.releases.map((r) => r.tag)).toEqual(['v2.0.0', 'v1.0.0']);
    expect(entry!.releases[0].publishedAt).not.toBeNull();
  });

  it('getEntryBySlug returns null for an unknown slug', async () => {
    expect(await getEntryBySlug(`does-not-exist-${stamp}`)).toBeNull();
  });

  it('updateMeta applies DSF fields, flips source to MANUAL, and audits', async () => {
    const updated = await updateMeta(
      id,
      { dsfVersionMin: '1.7.0', requiredRoles: ['DIC'], verified: true },
      admin,
      '127.0.0.1',
    );
    expect(updated.dsfVersionMin).toBe('1.7.0');
    expect(updated.requiredRoles).toEqual(['DIC']);
    expect(updated.verified).toBe(true);
    // A DSF field was edited → the manifest sync must no longer own this row.
    expect(updated.metadataSource).toBe('MANUAL');

    const audit = await db('audit_logs')
      .where({
        user_email: admin,
        resource_type: 'MARKETPLACE',
        resource_id: id,
        operation: 'UPDATE',
      })
      .first();
    expect(audit).toBeDefined();
  });

  it('updateMeta does not flip source to MANUAL when no DSF field is provided', async () => {
    // Reset to MANIFEST, then patch a non-DSF (trust) field only.
    await db('marketplace_entries').where({ id }).update({ metadata_source: 'MANIFEST' });
    const updated = await updateMeta(id, { advisoryText: 'patched' }, admin, '127.0.0.1');
    expect(updated.advisoryText).toBe('patched');
    expect(updated.metadataSource).toBe('MANIFEST');
  });

  it('updateMeta throws NOT_FOUND for a missing id', async () => {
    await expect(updateMeta(uuidv4(), { verified: true }, admin, '127.0.0.1')).rejects.toThrow(
      'NOT_FOUND',
    );
  });
});
