/**
 * certificate-schema.test.ts — pure Zod validation tests for certificate
 * input. No DB. Guards the PEM-presence check and the 20 KB size cap that
 * protects node-forge parsing from oversized input.
 */
import { createCertificateSchema } from '../schemas/certificate.schema';

describe('createCertificateSchema', () => {
  const validCert = `-----BEGIN CERTIFICATE-----\n${'A'.repeat(200)}\n-----END CERTIFICATE-----`;

  it('accepts a normal certificate PEM', () => {
    expect(createCertificateSchema.safeParse({ pem: validCert }).success).toBe(true);
  });

  it('rejects an empty pem', () => {
    expect(createCertificateSchema.safeParse({ pem: '' }).success).toBe(false);
  });

  it('rejects a string without the CERTIFICATE marker', () => {
    expect(createCertificateSchema.safeParse({ pem: 'not a certificate' }).success).toBe(false);
  });

  it('rejects a PEM larger than 20 KB (CPU-DoS guard)', () => {
    const huge = `-----BEGIN CERTIFICATE-----\n${'A'.repeat(20_001)}\n-----END CERTIFICATE-----`;
    expect(createCertificateSchema.safeParse({ pem: huge }).success).toBe(false);
  });

  it('accepts a PEM right at the 20 KB boundary', () => {
    const body = 'A'.repeat(
      20_000 - '-----BEGIN CERTIFICATE-----\n\n-----END CERTIFICATE-----'.length,
    );
    const atLimit = `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;
    expect(atLimit.length).toBeLessThanOrEqual(20_000);
    expect(createCertificateSchema.safeParse({ pem: atLimit }).success).toBe(true);
  });
});
