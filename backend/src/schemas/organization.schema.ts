/**
 * organization.schema.ts – Zod validation for organization input
 */
import { z } from 'zod';

export const upsertOrganizationSchema = z.object({
  identifier: z.string().min(1).max(255).regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/, 'Must be a valid FQDN'),
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  active: z.boolean().optional().default(true),
  addressLine: z.string().max(255).optional().default(''),
  postalCode: z.string().max(20).optional().default(''),
  city: z.string().max(100).optional().default(''),
  countryCode: z.string().length(2).optional().default(''),
  clientCertThumbprint: z.string().max(128).optional().nullable(),
});
