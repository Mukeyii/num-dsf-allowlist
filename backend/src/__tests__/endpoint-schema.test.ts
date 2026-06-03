/**
 * endpoint-schema.test.ts — pure Zod validation tests for endpoint input.
 * No DB. Locks the URL, length and IPv4 rules.
 */
import { createEndpointSchema } from '../schemas/endpoint.schema';

const base = {
  identifier: 'dsf-fhir.ukm.example.de',
  address: 'https://dsf-fhir.ukm.example.de/fhir',
};

describe('createEndpointSchema', () => {
  it('accepts a minimal valid endpoint', () => {
    expect(createEndpointSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a non-URL address', () => {
    expect(createEndpointSchema.safeParse({ ...base, address: 'not a url' }).success).toBe(false);
  });

  it('rejects an empty identifier', () => {
    expect(createEndpointSchema.safeParse({ ...base, identifier: '' }).success).toBe(false);
  });

  it('accepts valid IPv4 addresses', () => {
    const r = createEndpointSchema.safeParse({
      ...base,
      ipAddresses: [{ ip: '192.0.2.10', isFhir: true }],
    });
    expect(r.success).toBe(true);
  });

  it.each(['256.0.0.1', '10.0.0', 'abc', '2001:db8::1'])('rejects invalid IPv4 %p', (ip) => {
    expect(createEndpointSchema.safeParse({ ...base, ipAddresses: [{ ip }] }).success).toBe(false);
  });

  it('rejects an address longer than 500 chars', () => {
    const long = 'https://example.de/' + 'a'.repeat(500);
    expect(createEndpointSchema.safeParse({ ...base, address: long }).success).toBe(false);
  });
});
