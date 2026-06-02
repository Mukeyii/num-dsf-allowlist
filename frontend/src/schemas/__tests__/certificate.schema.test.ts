/**
 * certificate.schema.test.ts — pure validation tests for the certificate form
 * schema. Most important: the form rejects pasted PRIVATE KEY material before
 * it ever leaves the browser.
 */
import { describe, it, expect } from 'vitest';
import { certificateSchema } from '../certificate.schema';

const cert = `-----BEGIN CERTIFICATE-----\n${'A'.repeat(120)}\n-----END CERTIFICATE-----`;

describe('certificateSchema', () => {
  it('accepts a well-formed certificate PEM', () => {
    expect(certificateSchema.safeParse({ pem: cert }).success).toBe(true);
  });

  it('rejects an empty pem', () => {
    expect(certificateSchema.safeParse({ pem: '' }).success).toBe(false);
  });

  it('rejects a PEM missing the BEGIN/END markers', () => {
    expect(certificateSchema.safeParse({ pem: 'just some text' }).success).toBe(false);
  });

  it('rejects pasted private-key material', () => {
    const withKey = `-----BEGIN CERTIFICATE-----\nAAA\n-----END CERTIFICATE-----\n-----BEGIN PRIVATE KEY-----\nBBB\n-----END PRIVATE KEY-----`;
    expect(certificateSchema.safeParse({ pem: withKey }).success).toBe(false);
  });
});
