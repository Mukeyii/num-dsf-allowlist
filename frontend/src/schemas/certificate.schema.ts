/**
 * certificate.schema.ts — Zod schema for certificate PEM input.
 * Requires BEGIN/END CERTIFICATE markers and rejects any private-key material.
 */
import { z } from 'zod';

export const certificateSchema = z.object({
  pem: z
    .string()
    .min(1, 'certPemRequired')
    .refine((val) => val.includes('-----BEGIN CERTIFICATE-----'), 'certPemBegin')
    .refine((val) => val.includes('-----END CERTIFICATE-----'), 'certPemEnd')
    .refine((val) => !val.includes('PRIVATE KEY'), 'certPrivateKeyDetected'),
});

export type CertificateFormData = z.infer<typeof certificateSchema>;
