/**
 * certificate.schema.ts — Zod schema for certificate PEM input.
 * Requires BEGIN/END CERTIFICATE markers and rejects any private-key material.
 */
import { z } from 'zod';

export const certificateSchema = z.object({
  pem: z.string().min(1, 'Certificate PEM is required')
    .refine((val) => val.includes('-----BEGIN CERTIFICATE-----'), 'PEM must begin with -----BEGIN CERTIFICATE-----')
    .refine((val) => val.includes('-----END CERTIFICATE-----'), 'PEM must end with -----END CERTIFICATE-----')
    .refine((val) => !val.includes('PRIVATE KEY'), '⚠ Private key material detected. Remove the private key and paste only the certificate.'),
});

export type CertificateFormData = z.infer<typeof certificateSchema>;
