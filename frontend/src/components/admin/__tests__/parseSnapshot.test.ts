/**
 * parseSnapshot.test.ts — covers the tolerant snapshot parser: a valid JSON
 * string parses to the typed shape with every field mapped, an already-parsed
 * object passes through untouched, and malformed/empty/null input degrades to
 * {} without throwing.
 */
import { describe, it, expect } from 'vitest';
import { parseSnapshot, type SnapshotData } from '../parseSnapshot';

const FULL: SnapshotData = {
  organization: {
    name: 'Uniklinik Münster',
    identifier: 'ukm.de',
    email: 'dsf@ukm.de',
    city: 'Münster',
    country_code: 'DE',
    active: true,
    address_line: 'Albert-Schweitzer-Campus 1',
    postal_code: '48149',
  },
  endpoints: [
    {
      identifier: 'ep-1',
      address: 'https://ukm.de/fhir',
      name: 'UKM FHIR',
      ips: [{ ip: '10.0.0.1', is_fhir: true, is_bpe: false }],
    },
  ],
  certificates: [{ subject: 'CN=ukm.de', thumbprint: 'AB12', valid_until: '2027-01-01' }],
  memberships: [{ parent_organization: 'num.de', roles: ['DIC', 'HRP'], endpoint_id: 'ep-1' }],
  contacts: [{ name: 'Dr. A', email: 'a@ukm.de', types: ['MEDIC'] }],
};

describe('parseSnapshot', () => {
  it('parses a valid JSON string into the typed shape with every field mapped', () => {
    const result = parseSnapshot(JSON.stringify(FULL));
    expect(result).toEqual(FULL);
    // Spot-check that nested fields survived the round-trip.
    expect(result.organization?.identifier).toBe('ukm.de');
    expect(result.endpoints?.[0].ips?.[0]).toEqual({
      ip: '10.0.0.1',
      is_fhir: true,
      is_bpe: false,
    });
    expect(result.memberships?.[0].roles).toEqual(['DIC', 'HRP']);
    expect(result.contacts?.[0].email).toBe('a@ukm.de');
  });

  it('passes an already-parsed object through untouched', () => {
    const obj = { organization: { name: 'X' } };
    expect(parseSnapshot(obj)).toBe(obj);
  });

  it('returns {} for null', () => {
    expect(parseSnapshot(null)).toEqual({});
  });

  it('returns {} for undefined', () => {
    expect(parseSnapshot(undefined)).toEqual({});
  });

  it('returns {} for an empty string', () => {
    expect(parseSnapshot('')).toEqual({});
  });

  it('returns {} for malformed JSON without throwing', () => {
    expect(() => parseSnapshot('{ not json')).not.toThrow();
    expect(parseSnapshot('{ not json')).toEqual({});
  });
});
