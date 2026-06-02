/**
 * certificate.schema.ts – Zod validation for certificate input
 */
import { z } from 'zod';

// 20 KB is well above any real X.509 chain but caps the input so a pasted
// multi-megabyte blob cannot tie up node-forge parsing (CPU DoS).
const MAX_PEM_BYTES = 20_000;

export const createCertificateSchema = z.object({
  pem: z.string().min(1).max(MAX_PEM_BYTES).refine(
    (val) => val.includes('-----BEGIN CERTIFICATE-----'),
    { message: 'Must contain a valid PEM certificate' }
  ),
});
