/**
 * germanyPaths.test.ts – Sanity tests for the inlined Germany silhouette data
 */
import { describe, it, expect } from 'vitest';
import { GERMANY_PATHS } from '../germanyPaths';

describe('GERMANY_PATHS', () => {
  it('contains exactly 16 federal states', () => {
    expect(GERMANY_PATHS).toHaveLength(16);
  });

  it('every entry has a non-empty id and SVG path data', () => {
    for (const p of GERMANY_PATHS) {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.d.length).toBeGreaterThan(0);
      expect(p.d.startsWith('M')).toBe(true);
    }
  });

  it('ids are unique', () => {
    const ids = new Set(GERMANY_PATHS.map(p => p.id));
    expect(ids.size).toBe(GERMANY_PATHS.length);
  });
});
