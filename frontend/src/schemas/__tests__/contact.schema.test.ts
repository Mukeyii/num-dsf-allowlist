/**
 * contact.schema.test.ts — pure validation tests for the contact form schema.
 * Locks the type-enum, email and phone-format rules.
 */
import { describe, it, expect } from 'vitest';
import { contactSchema } from '../contact.schema';

const base = { types: ['MEDIC'], email: 'medic@ukm.example.de' };

describe('contactSchema', () => {
  it('accepts a minimal valid contact', () => {
    expect(contactSchema.safeParse(base).success).toBe(true);
  });

  it('requires at least one type', () => {
    expect(contactSchema.safeParse({ ...base, types: [] }).success).toBe(false);
  });

  it('rejects an unknown contact type', () => {
    expect(contactSchema.safeParse({ ...base, types: ['ADMIN'] }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(contactSchema.safeParse({ ...base, email: 'nope' }).success).toBe(false);
  });

  it('accepts an empty phone but rejects a malformed one', () => {
    expect(contactSchema.safeParse({ ...base, phone: '' }).success).toBe(true);
    expect(contactSchema.safeParse({ ...base, phone: 'call me' }).success).toBe(false);
  });
});
