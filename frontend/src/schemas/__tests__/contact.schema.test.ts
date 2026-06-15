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

  it('rejects an email longer than 255 chars (backend max)', () => {
    const longEmail = `${'a'.repeat(247)}@ukm.de`; // 247 + 7 = 254 -> ok
    expect(contactSchema.safeParse({ ...base, email: longEmail }).success).toBe(true);
    const tooLong = `${'a'.repeat(249)}@ukm.de`; // 249 + 7 = 256 -> too long
    expect(tooLong.length).toBe(256);
    expect(contactSchema.safeParse({ ...base, email: tooLong }).success).toBe(false);
  });

  it('accepts an empty phone but rejects a malformed one', () => {
    expect(contactSchema.safeParse({ ...base, phone: '' }).success).toBe(true);
    expect(contactSchema.safeParse({ ...base, phone: 'call me' }).success).toBe(false);
  });
});
