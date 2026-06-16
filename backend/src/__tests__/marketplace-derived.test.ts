/**
 * marketplace-derived.test.ts — pure tests for the read-time derivations
 * (license-OSI badge, staleness). No DB. License-compliance and staleness are
 * computed on read, never stored, so these helpers are the single source.
 */
import { isLicenseOsi, isStale } from '../lib/marketplaceDerived';

describe('isLicenseOsi', () => {
  it('accepts common OSI SPDX ids', () => {
    expect(isLicenseOsi('MIT')).toBe(true);
    expect(isLicenseOsi('Apache-2.0')).toBe(true);
  });

  it('rejects NOASSERTION and unknown ids', () => {
    expect(isLicenseOsi('NOASSERTION')).toBe(false);
  });

  it('rejects null', () => {
    expect(isLicenseOsi(null)).toBe(false);
  });
});

describe('isStale', () => {
  const now = new Date('2026-06-16T00:00:00Z');

  it('is stale when archived regardless of commit date', () => {
    expect(isStale(true, now, now)).toBe(true);
  });

  it('is stale when the last commit is older than a year', () => {
    const thirteenMonthsAgo = new Date('2025-05-16T00:00:00Z');
    expect(isStale(false, thirteenMonthsAgo, now)).toBe(true);
  });

  it('is not stale when the last commit is recent', () => {
    const oneMonthAgo = new Date('2026-05-16T00:00:00Z');
    expect(isStale(false, oneMonthAgo, now)).toBe(false);
  });

  it('is not stale when there is no commit date and not archived', () => {
    expect(isStale(false, null, now)).toBe(false);
  });
});
