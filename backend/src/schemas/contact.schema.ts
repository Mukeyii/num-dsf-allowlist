/**
 * contact.schema.ts – Zod validation for contact input
 */
import { z } from 'zod';

const contactTypes = z.enum(['MEDIC', 'DSF_ADMIN', 'SECURITY']);

export const createContactSchema = z.object({
  types: z.array(contactTypes).min(1),
  name: z.string().max(255).optional().default(''),
  email: z.string().email().max(255),
  phone: z.string().max(50).regex(/^\+?[\d\s\-()]{7,20}$/, 'Invalid phone format').optional().or(z.literal('')),
  addressLine: z.string().max(255).optional().default(''),
  city: z.string().max(100).optional().default(''),
  postalCode: z.string().max(20).optional().default(''),
  countryCode: z.string().length(2).optional().or(z.literal('')),
});

export const updateContactSchema = createContactSchema;
