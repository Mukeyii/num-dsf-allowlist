/**
 * membership.schema.test.ts — pure validation tests for the membership form
 * schema. Locks the required parent/endpoint and role-enum rules.
 */
import { describe, it, expect } from 'vitest';
import { membershipSchema } from '../membership.schema';

const base = {
  parentOrganization: 'mii.example.de',
  endpointId: 'dsf-fhir.ukm.example.de',
  roles: ['DIC'],
};

describe('membershipSchema', () => {
  it('accepts a minimal valid membership', () => {
    expect(membershipSchema.safeParse(base).success).toBe(true);
  });

  it('requires a parent organization', () => {
    expect(membershipSchema.safeParse({ ...base, parentOrganization: '' }).success).toBe(false);
  });

  it('requires an endpoint', () => {
    expect(membershipSchema.safeParse({ ...base, endpointId: '' }).success).toBe(false);
  });

  it('requires at least one role', () => {
    expect(membershipSchema.safeParse({ ...base, roles: [] }).success).toBe(false);
  });

  it('rejects an unknown role', () => {
    expect(membershipSchema.safeParse({ ...base, roles: ['KING'] }).success).toBe(false);
  });
});
