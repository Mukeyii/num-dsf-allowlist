/**
 * ca-blacklist-dn-normalize.test.ts
 * Regression cover for the deny-list bypass: an admin-typed subject DN and
 * node-forge's rendered issuer DN differ cosmetically (surrounding spaces,
 * attribute order, letter case). isCaBlacklisted must normalize both sides so
 * those variants still match, while a genuinely different DN stays a miss.
 */
import { db } from '../db/connection';
import { addToBlacklist, isCaBlacklisted, normalizeDn } from '../services/ca-blacklist.service';

// Admin-typed form, with spaces after the commas.
const ADMIN_TYPED_DN = 'CN=Foo Root CA, O=Foo, C=DE';
const ADMIN_EMAIL = `cab-dn-${Date.now()}@example.de`;

describe('ca-blacklist DN normalization', () => {
  beforeAll(async () => {
    await addToBlacklist({ subjectDn: ADMIN_TYPED_DN, reason: 'jest dn-normalize' }, ADMIN_EMAIL);
  });

  afterAll(async () => {
    await db('ca_blacklist').where({ added_by: ADMIN_EMAIL }).del();
  });

  it('matches a DN with no spaces (node-forge rendering)', async () => {
    expect(await isCaBlacklisted({ subjectDn: 'CN=Foo Root CA,O=Foo,C=DE' })).toBe(true);
  });

  it('matches a reordered, lower-cased DN', async () => {
    expect(await isCaBlacklisted({ subjectDn: 'c=de,o=foo,cn=foo root ca' })).toBe(true);
  });

  it('does not match a genuinely different DN', async () => {
    expect(await isCaBlacklisted({ subjectDn: 'CN=Other CA,O=Foo,C=DE' })).toBe(false);
  });

  it('normalizeDn yields equal output for cosmetic variants', () => {
    const canonical = normalizeDn('CN=Foo Root CA,O=Foo,C=DE');
    expect(normalizeDn('CN=Foo Root CA, O=Foo, C=DE')).toBe(canonical);
    expect(normalizeDn('c=de,o=foo,cn=foo root ca')).toBe(canonical);
    expect(normalizeDn('CN=Other CA,O=Foo,C=DE')).not.toBe(canonical);
  });
});
