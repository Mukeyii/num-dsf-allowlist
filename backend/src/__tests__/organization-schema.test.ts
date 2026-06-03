/**
 * organization-schema.test.ts — pure Zod validation tests for organization
 * input. No DB. Locks the FQDN, email, country-code and length rules so a
 * regression in the schema is caught without an integration round-trip.
 */
import { upsertOrganizationSchema } from '../schemas/organization.schema';

const base = {
  identifier: 'ukm.example.de',
  name: 'Uniklinik Muenster',
  email: 'admin@ukm.example.de',
};

describe('upsertOrganizationSchema', () => {
  it('accepts a minimal valid organization', () => {
    expect(upsertOrganizationSchema.safeParse(base).success).toBe(true);
  });

  it.each(['NotAnFqdn', 'no-tld', '-leading-dash.de', 'has space.de', 'UPPER.de'])(
    'rejects invalid FQDN identifier %p',
    (identifier) => {
      expect(upsertOrganizationSchema.safeParse({ ...base, identifier }).success).toBe(false);
    },
  );

  it('rejects an invalid email', () => {
    expect(upsertOrganizationSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(
      false,
    );
  });

  it('accepts an empty country code but rejects a 3-letter one', () => {
    expect(upsertOrganizationSchema.safeParse({ ...base, countryCode: '' }).success).toBe(true);
    expect(upsertOrganizationSchema.safeParse({ ...base, countryCode: 'DEU' }).success).toBe(false);
  });

  it('rejects a name longer than 255 chars', () => {
    expect(upsertOrganizationSchema.safeParse({ ...base, name: 'x'.repeat(256) }).success).toBe(
      false,
    );
  });

  it('rejects a totpCode that is not exactly 6 chars', () => {
    expect(upsertOrganizationSchema.safeParse({ ...base, totpCode: '123' }).success).toBe(false);
  });
});
