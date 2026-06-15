/**
 * organization.schema.ts — Zod schema for organization form input (FQDN identifier, name, email, address).
 * Validates the identifier as an FQDN and the country code as a 2-letter ISO code.
 */
import { z } from 'zod';

export const organizationSchema = z.object({
  identifier: z
    .string()
    .min(3, 'Identifier must be at least 3 characters')
    // Mirror the backend FQDN rule: lowercase only, alphabetic TLD, no trailing dot.
    .regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/, 'Must be a valid FQDN (e.g. ukm.de)'),
  name: z.string().min(1, 'Name is required'),
  active: z.boolean().default(true),
  email: z
    .string()
    .email('Must be a valid email address')
    .max(255, 'Email must be at most 255 characters'),
  addressLine: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  countryCode: z
    .string()
    .length(2, 'Must be a 2-letter ISO country code (e.g. DE)')
    .toUpperCase()
    .optional()
    .or(z.literal('')),
  clientCertThumbprint: z
    .string()
    .max(128, 'Thumbprint must be at most 128 characters')
    .optional()
    .or(z.literal('')),
});

export type OrganizationFormData = z.infer<typeof organizationSchema>;
