/**
 * statusColors.test.ts — locks the certificate-status color quartet. These hex
 * values are the single source of truth shared by map pins, clusters, filters
 * and the detail panel, so an accidental edit should fail a test, not silently
 * recolor the UI.
 */
import { describe, it, expect } from 'vitest';
import { STATUS_COLOR } from '../statusColors';

describe('STATUS_COLOR', () => {
  it('exports exactly the four cert_status keys', () => {
    expect(Object.keys(STATUS_COLOR).sort()).toEqual(['EXPIRED', 'EXPIRING', 'NONE', 'VALID']);
  });

  it('maps each status to its expected hex color', () => {
    expect(STATUS_COLOR).toEqual({
      VALID: '#22c55e',
      EXPIRING: '#f5a623',
      EXPIRED: '#ef4444',
      NONE: '#94a3b8',
    });
  });

  it('uses distinct colors for every status', () => {
    const values = Object.values(STATUS_COLOR);
    expect(new Set(values).size).toBe(values.length);
  });
});
