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

// The edit modal carries the DSF/trust fields as plain text inputs (array
// fields comma-separated); they are split into arrays on submit. Only status
// and totpCode are constrained here — the backend validates the rest strictly.
export const marketplaceEditFormSchema = z.object({
  status: z.enum(['APPROVED', 'EXPERIMENTAL', 'DEPRECATED']),
  verified: z.boolean().optional(),
  advisoryText: z.string().optional(),
  advisorySeverity: z.enum(['', 'INFO', 'WARNING', 'CRITICAL']).optional(),
  supersededBy: z.string().optional(),
  processIdentifiers: z.string().optional(),
  dsfVersionMin: z.string().optional(),
  requiredRoles: z.string().optional(),
  messageNames: z.string().optional(),
  artifactUrl: z.string().optional(),
  totpCode: z.string().length(6),
});

export type MarketplaceEditForm = z.infer<typeof marketplaceEditFormSchema>;
