/**
 * certificate.schema.ts – Zod validation for certificate input
 */
import { z } from 'zod';

export const createCertificateSchema = z.object({
  pem: z.string().min(1).refine(
    (val) => val.includes('-----BEGIN CERTIFICATE-----'),
    { message: 'Must contain a valid PEM certificate' }
  ),
});
