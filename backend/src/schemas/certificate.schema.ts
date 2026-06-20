/**
 * certificate.schema.ts – Zod validation for certificate input
 */
import { z } from 'zod';

// 20 KB is well above any real X.509 chain but caps the input so a pasted
// multi-megabyte blob cannot tie up node-forge parsing (CPU DoS).
const MAX_PEM_BYTES = 20_000;

const pemField = z
  .string()
  .min(1)
  .max(MAX_PEM_BYTES)
  .refine((val) => val.includes('-----BEGIN CERTIFICATE-----'), {
    message: 'Must contain a valid PEM certificate',
  });

export const createCertificateSchema = z.object({
  pem: pemField,
});

// The renew endpoint receives the same single-field body as create:
// { pem }. The cert being replaced is identified by the :cid route param,
// not the body.
export const renewCertificateSchema = z.object({
  pem: pemField,
});
