/**
 * bundle-versions.test.ts
 * Service-level tests for createSnapshot / listVersions / getVersion /
 * diffVersions. The bundle returned by generateFullBundle is whatever
 * the test DB happens to hold; we only assert structural properties
 * of the snapshot rows and the diff API, not specific FHIR content.
 */
import { db } from '../db/connection';
import {
  createSnapshot,
  listVersions,
  getVersion,
  diffVersions,
} from '../services/bundle-versions.service';

const ADMIN_EMAIL = `bv-${Date.now()}@example.de`;

describe('bundle-versions service', () => {
  let firstId = '';
  let secondId = '';

  afterAll(async () => {
    if (firstId) await db('bundle_versions').where({ id: firstId }).del();
    if (secondId) await db('bundle_versions').where({ id: secondId }).del();
  });

  it('createSnapshot returns id + monotonic versionNumber + content hash', async () => {
    const a = await createSnapshot({
      triggeredBy: 'MANUAL',
      triggeredByEmail: ADMIN_EMAIL,
      notes: 'first',
    });
    firstId = a.id;
    const b = await createSnapshot({
      triggeredBy: 'MANUAL',
      triggeredByEmail: ADMIN_EMAIL,
      notes: 'second',
    });
    secondId = b.id;
    expect(b.versionNumber).toBeGreaterThan(a.versionNumber);
    expect(a.contentHash).toMatch(/^[a-f0-9]{64}$/i);
    expect(b.contentHash).toMatch(/^[a-f0-9]{64}$/i);
  });

  it('listVersions returns the snapshots newest-first', async () => {
    const { rows, total } = await listVersions({ page: 1, limit: 50 });
    expect(total).toBeGreaterThanOrEqual(2);
    const idx1 = rows.findIndex((r) => r.id === firstId);
    const idx2 = rows.findIndex((r) => r.id === secondId);
    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeLessThan(idx1); // 'second' (higher version_number) appears earlier in DESC order
  });

  it('getVersion returns the parsed bundle alongside the row', async () => {
    const v = await getVersion(firstId);
    expect(v.id).toBe(firstId);
    expect(v.bundle).toBeDefined();
    expect((v.bundle as { resourceType: string }).resourceType).toBe('Bundle');
  });

  it('getVersion throws NOT_FOUND on an unknown id', async () => {
    await expect(getVersion('00000000-0000-0000-0000-000000000000')).rejects.toThrow('NOT_FOUND');
  });

  it('diffVersions returns empty buckets for two identical snapshots', async () => {
    // The two snapshots were taken without any DB mutation in between, so
    // generateFullBundle returns the same content both times; diff buckets
    // should be empty (added/removed/changed all length zero).
    const diff = await diffVersions(firstId, secondId);
    expect(Array.isArray(diff.added)).toBe(true);
    expect(Array.isArray(diff.removed)).toBe(true);
    expect(Array.isArray(diff.changed)).toBe(true);
    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(0);
    expect(diff.changed.length).toBe(0);
  });
});
