/**
 * marketplace-manifest.test.ts — pure tests for the dsf-marketplace.json
 * manifest schema and parseManifest(). No DB. Guards the .strict() contract
 * (extra keys rejected) and the per-field validators the daily sync relies on.
 */
import { parseManifest } from '../schemas/marketplace-manifest.schema';

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
