/**
 * contact-schema.test.ts — pure Zod validation tests for contact input.
 * No DB. Locks the type-enum, email and phone-format rules.
 */
import { createContactSchema } from '../schemas/contact.schema';

const base = {
  types: ['MEDIC'] as const,
  email: 'medic@ukm.example.de',
};

describe('createContactSchema', () => {
  it('accepts a minimal valid contact', () => {
    expect(createContactSchema.safeParse(base).success).toBe(true);
  });

  it('requires at least one type', () => {
    expect(createContactSchema.safeParse({ ...base, types: [] }).success).toBe(false);
  });

  it('rejects an unknown contact type', () => {
    expect(createContactSchema.safeParse({ ...base, types: ['ADMIN'] }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(createContactSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
  });

  it('accepts an empty phone but rejects a malformed one', () => {
    expect(createContactSchema.safeParse({ ...base, phone: '' }).success).toBe(true);
    expect(createContactSchema.safeParse({ ...base, phone: 'call-me' }).success).toBe(false);
  });

  it('accepts a well-formed international phone number', () => {
    expect(createContactSchema.safeParse({ ...base, phone: '+49 251 8350' }).success).toBe(true);
  });
});
