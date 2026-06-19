/**
 * contact.schema.ts — Zod schema for contact form input (types, name, email, phone, address).
 * Requires at least one contact type and a valid email; optional fields validated when present.
 */
import { z } from 'zod';

const CONTACT_TYPES = ['MEDIC', 'DSF_ADMIN', 'SECURITY'] as const;

export const contactSchema = z.object({
  types: z.array(z.enum(CONTACT_TYPES)).min(1, 'contactTypesRequired'),
  name: z.string().optional(),
  email: z.string().email('emailInvalid').max(255, 'emailTooLong'),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-()]{7,20}$/, 'contactPhoneInvalid')
    .optional()
    .or(z.literal('')),
  addressLine: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  countryCode: z
    .string()
    .length(2, 'countryCodeInvalid')
    .toUpperCase()
    .optional()
    .or(z.literal('')),
});

export type ContactFormData = z.infer<typeof contactSchema>;
