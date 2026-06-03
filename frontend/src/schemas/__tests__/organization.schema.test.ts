/**
 * organization.schema.test.ts — pure validation tests for the organization
 * form schema. The frontend FQDN rule is case-insensitive (unlike the
 * stricter lowercase-only backend rule) and the country code is upper-cased.
 */
import { describe, it, expect } from 'vitest';
import { organizationSchema } from '../organization.schema';

const base = {
  identifier: 'ukm.example.de',
  name: 'Uniklinik Muenster',
  email: 'admin@ukm.example.de',
};

describe('organizationSchema', () => {
  it('accepts a minimal valid organization', () => {
    expect(organizationSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a mixed-case FQDN (frontend is case-insensitive)', () => {
    expect(organizationSchema.safeParse({ ...base, identifier: 'UKM.Example.de' }).success).toBe(
      true,
    );
  });

  it('rejects an identifier shorter than 3 chars', () => {
    expect(organizationSchema.safeParse({ ...base, identifier: 'a' }).success).toBe(false);
  });

  it('rejects a non-FQDN identifier', () => {
    expect(organizationSchema.safeParse({ ...base, identifier: 'no-dot' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(organizationSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
  });

  it('upper-cases the country code', () => {
    const r = organizationSchema.safeParse({ ...base, countryCode: 'de' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.countryCode).toBe('DE');
  });

  it('rejects a 3-letter country code', () => {
    expect(organizationSchema.safeParse({ ...base, countryCode: 'deu' }).success).toBe(false);
  });
});
