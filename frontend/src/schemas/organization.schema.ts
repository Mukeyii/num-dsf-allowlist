import { z } from 'zod';

export const organizationSchema = z.object({
  identifier: z.string().min(3, 'Identifier must be at least 3 characters').regex(/^[a-z0-9][a-z0-9-]*\.[a-z]{2,}$/, 'Must be a valid FQDN (e.g. ukm.de)'),
  name: z.string().min(2, 'Name is required'),
  active: z.boolean().default(true),
  email: z.string().email('Must be a valid email address'),
  addressLine: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  countryCode: z.string().length(2, 'Must be a 2-letter ISO country code (e.g. DE)').toUpperCase().optional().or(z.literal('')),
});

export type OrganizationFormData = z.infer<typeof organizationSchema>;
