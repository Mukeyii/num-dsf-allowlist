/**
 * contact.schema.ts — Zod schema for contact form input (types, name, email, phone, address).
 * Requires at least one contact type and a valid email; optional fields validated when present.
 */
import { z } from 'zod';

const CONTACT_TYPES = ['MEDIC', 'DSF_ADMIN', 'SECURITY'] as const;

export const contactSchema = z.object({
  types: z.array(z.enum(CONTACT_TYPES)).min(1, 'Select at least one type'),
  name: z.string().optional(),
  email: z.string().email('Must be a valid email address'),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-()]{7,20}$/, 'Invalid phone format (e.g. +49 251 12345)')
    .optional()
    .or(z.literal('')),
  addressLine: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  countryCode: z.string().length(2).toUpperCase().optional().or(z.literal('')),
});

export type ContactFormData = z.infer<typeof contactSchema>;
