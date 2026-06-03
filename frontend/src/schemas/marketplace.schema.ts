/**
 * marketplace.schema.ts – Zod schemas for marketplace forms
 * Dependencies: zod
 */
import { z } from 'zod';

export const marketplaceAddFormSchema = z.object({
  gitUrl: z
    .string()
    .regex(/^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(?:\.git)?\/?$/, 'invalid'),
  status: z.enum(['APPROVED', 'EXPERIMENTAL', 'DEPRECATED']).default('APPROVED'),
  totpCode: z.string().length(6),
});

export type MarketplaceAddForm = z.infer<typeof marketplaceAddFormSchema>;

export const marketplaceEditFormSchema = z.object({
  status: z.enum(['APPROVED', 'EXPERIMENTAL', 'DEPRECATED']),
  totpCode: z.string().length(6),
});

export type MarketplaceEditForm = z.infer<typeof marketplaceEditFormSchema>;
