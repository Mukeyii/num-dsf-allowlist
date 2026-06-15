/**
 * organization.schema.test.ts — pure validation tests for the organization
 * form schema. The frontend FQDN rule mirrors the backend (lowercase only,
 * alphabetic TLD, no trailing dot) and the country code is upper-cased.
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

  it('rejects a mixed-case FQDN (backend is lowercase-only)', () => {
    expect(organizationSchema.safeParse({ ...base, identifier: 'UKM.Example.de' }).success).toBe(
      false,
    );
  });

  it('rejects a trailing-dot FQDN (backend rejects it)', () => {
    expect(organizationSchema.safeParse({ ...base, identifier: 'ukm.example.de.' }).success).toBe(
      false,
    );
  });

  it('rejects a numeric TLD (backend requires an alphabetic TLD)', () => {
    expect(organizationSchema.safeParse({ ...base, identifier: 'ukm.example.42' }).success).toBe(
      false,
    );
  });

  it('rejects an identifier shorter than 3 chars', () => {
    expect(organizationSchema.safeParse({ ...base, identifier: 'a' }).success).toBe(false);
  });

  it('rejects a non-FQDN identifier', () => {
    expect(organizationSchema.safeParse({ ...base, identifier: 'no-dot' }).success).toBe(false);
  });

  it('accepts a single-character name (backend min is 1)', () => {
    expect(organizationSchema.safeParse({ ...base, name: 'A' }).success).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(organizationSchema.safeParse({ ...base, name: '' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(organizationSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
  });

  it('rejects an email longer than 255 chars (backend max)', () => {
    const tooLong = `${'a'.repeat(249)}@ukm.de`; // 249 + 7 = 256 -> too long
    expect(tooLong.length).toBe(256);
    expect(organizationSchema.safeParse({ ...base, email: tooLong }).success).toBe(false);
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
