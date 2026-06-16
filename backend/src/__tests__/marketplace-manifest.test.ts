/**
 * marketplace-manifest.test.ts — pure tests for the dsf-marketplace.json
 * manifest schema and parseManifest(). No DB. Guards the .strict() contract
 * (extra keys rejected) and the per-field validators the daily sync relies on.
 */
import { parseManifest } from '../schemas/marketplace-manifest.schema';
import { slugify, patchMarketplaceMetaSchema } from '../schemas/marketplace.schema';

describe('parseManifest', () => {
  const validFull = {
    processIdentifiers: ['dsf.org/process/dataSend'],
    dsfVersionMin: '1.5',
    requiredRoles: ['DIC', 'HRP'],
    messageNames: ['dataSendStart'],
    artifactUrl: 'https://github.com/owner/repo/releases/download/v1/plugin.jar',
  };

  it('returns ok:true with data for a valid full manifest', () => {
    const res = parseManifest(validFull);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.dsfVersionMin).toBe('1.5');
  });

  it('returns ok:true for an empty object (all fields optional)', () => {
    const res = parseManifest({});
    expect(res.ok).toBe(true);
  });

  it('returns ok:false for an unknown top-level key (.strict)', () => {
    const res = parseManifest({ ...validFull, extra: 'nope' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(typeof res.error).toBe('string');
  });

  it('returns ok:false for lowercase required roles', () => {
    const res = parseManifest({ requiredRoles: ['dic'] });
    expect(res.ok).toBe(false);
  });

  it('returns ok:false for a non-numeric dsfVersionMin', () => {
    const res = parseManifest({ dsfVersionMin: 'banana' });
    expect(res.ok).toBe(false);
  });

  it('returns ok:false for a non-object input', () => {
    expect(parseManifest('not an object').ok).toBe(false);
    expect(parseManifest(null).ok).toBe(false);
    expect(parseManifest(42).ok).toBe(false);
  });
});

describe('slugify', () => {
  it('lowercases and joins owner-repo with a dash', () => {
    expect(slugify('Owner', 'My.Repo')).toBe('owner-my.repo');
  });
});

describe('patchMarketplaceMetaSchema', () => {
  it('accepts a full valid patch body', () => {
    const res = patchMarketplaceMetaSchema.safeParse({
      status: 'DEPRECATED',
      verified: true,
      advisoryText: 'CVE-2026-0001',
      advisorySeverity: 'CRITICAL',
      supersededBy: 'owner-newrepo',
      processIdentifiers: ['dsf.org/process/dataSend'],
      dsfVersionMin: '1.5',
      requiredRoles: ['DIC'],
      messageNames: ['dataSendStart'],
      artifactUrl: 'https://github.com/owner/repo/releases/download/v1/plugin.jar',
      totpCode: '123456',
    });
    expect(res.success).toBe(true);
  });

  it('accepts null advisory and superseded values', () => {
    const res = patchMarketplaceMetaSchema.safeParse({
      advisoryText: null,
      advisorySeverity: null,
      supersededBy: null,
      totpCode: '123456',
    });
    expect(res.success).toBe(true);
  });

  it('rejects an unknown advisory severity', () => {
    const res = patchMarketplaceMetaSchema.safeParse({
      advisorySeverity: 'FATAL',
      totpCode: '123456',
    });
    expect(res.success).toBe(false);
  });

  it('rejects a totpCode that is not 6 chars', () => {
    const res = patchMarketplaceMetaSchema.safeParse({ totpCode: '123' });
    expect(res.success).toBe(false);
  });

  it('reuses the manifest role validator (lowercase rejected)', () => {
    const res = patchMarketplaceMetaSchema.safeParse({
      requiredRoles: ['dic'],
      totpCode: '123456',
    });
    expect(res.success).toBe(false);
  });
});
