/**
 * endpoint.schema.test.ts — pure validation tests for the endpoint form
 * schema. Locks the FQDN identifier, the https-only address rule and IPv4.
 */
import { describe, it, expect } from 'vitest';
import { endpointSchema } from '../endpoint.schema';

const base = {
  identifier: 'dsf-fhir.ukm.example.de',
  address: 'https://dsf-fhir.ukm.example.de/fhir',
};

describe('endpointSchema', () => {
  it('accepts a minimal valid endpoint', () => {
    expect(endpointSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a non-https address', () => {
    expect(endpointSchema.safeParse({ ...base, address: 'http://insecure.example.de/fhir' }).success).toBe(false);
  });

  it('rejects an identifier shorter than 3 chars', () => {
    expect(endpointSchema.safeParse({ ...base, identifier: 'a' }).success).toBe(false);
  });

  it('accepts valid IPv4 and rejects invalid', () => {
    expect(endpointSchema.safeParse({ ...base, ipAddresses: [{ ip: '192.0.2.10' }] }).success).toBe(true);
    expect(endpointSchema.safeParse({ ...base, ipAddresses: [{ ip: '999.1.1.1' }] }).success).toBe(false);
  });
});
