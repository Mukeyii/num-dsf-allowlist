/**
 * ca-blacklist.test.ts
 * Service-level CRUD + lookup tests for the CA blacklist.
 */
import { db } from '../db/connection';
import {
  isCaBlacklisted,
  addToBlacklist,
  listBlacklist,
  removeFromBlacklist,
  listKnownCas,
} from '../services/ca-blacklist.service';

const TEST_SUBJECT = `CN=BadCo CA,O=BadCo-${Date.now()},C=US`;
const ADMIN_EMAIL = `cab-admin-${Date.now()}@example.de`;

describe('ca-blacklist service', () => {
  afterEach(async () => {
    await db('ca_blacklist').where({ added_by: ADMIN_EMAIL }).del();
  });

  it('isCaBlacklisted returns false when subject not present', async () => {
    expect(await isCaBlacklisted({ subjectDn: 'CN=Unknown CA,O=Test,C=DE' })).toBe(false);
  });

  it('isCaBlacklisted returns false when no args at all', async () => {
    expect(await isCaBlacklisted({})).toBe(false);
  });

  it('addToBlacklist then isCaBlacklisted returns true', async () => {
    await addToBlacklist({ subjectDn: TEST_SUBJECT, reason: 'jest test' }, ADMIN_EMAIL);
    expect(await isCaBlacklisted({ subjectDn: TEST_SUBJECT })).toBe(true);
  });

  it('lists current entries and supports removal', async () => {
    const id = await addToBlacklist({ subjectDn: TEST_SUBJECT, reason: 'jest' }, ADMIN_EMAIL);
    const before = await listBlacklist();
    expect(before.find((r) => r.id === id)).toBeDefined();

    await removeFromBlacklist(id, ADMIN_EMAIL);
    const after = await listBlacklist();
    expect(after.find((r) => r.id === id)).toBeUndefined();
    expect(await isCaBlacklisted({ subjectDn: TEST_SUBJECT })).toBe(false);
  });

  it('fingerprint match (upper-cased) hits the index', async () => {
    const fingerprint = 'abc'.repeat(20) + 'abcd';
    await addToBlacklist({ subjectDn: TEST_SUBJECT, fingerprint }, ADMIN_EMAIL);
    expect(await isCaBlacklisted({ fingerprint: fingerprint.toUpperCase() })).toBe(true);
    // Lower-case lookup still hits because the service upper-cases internally.
    expect(await isCaBlacklisted({ fingerprint })).toBe(true);
  });

  it('removeFromBlacklist with unknown id throws NOT_FOUND', async () => {
    await expect(
      removeFromBlacklist('00000000-0000-0000-0000-000000000000', ADMIN_EMAIL),
    ).rejects.toThrow('NOT_FOUND');
  });

  it('listKnownCas returns rows sorted by subject_dn', async () => {
    const rows = await listKnownCas();
    expect(Array.isArray(rows)).toBe(true);
    // If the seed/sync ran the list is non-empty; either way the call must succeed.
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].subject_dn >= rows[i - 1].subject_dn).toBe(true);
    }
  });
});
