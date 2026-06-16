/**
 * marketplace-manifest.schema.ts – Zod for the optional dsf-marketplace.json
 * a marketplace repo may ship. The daily sync fetches and parses it via
 * parseManifest(); .strict() rejects unknown keys so a typo never silently
 * drops DSF metadata. All fields are optional (a partial manifest is valid).
 */
import { z } from 'zod';

export const dsfManifestSchema = z
  .object({
    processIdentifiers: z.array(z.string().min(1).max(255)).max(20).optional(),
    dsfVersionMin: z
      .string()
      .regex(/^\d+\.\d+(\.\d+)?$/)
      .optional(),
    requiredRoles: z
      .array(z.string().regex(/^[A-Z][A-Z0-9_]{1,15}$/))
      .max(15)
      .optional(),
    messageNames: z.array(z.string().min(1).max(255)).max(30).optional(),
    artifactUrl: z.string().url().startsWith('https://github.com/').max(500).optional(),
  })
  .strict();

export type DsfManifest = z.infer<typeof dsfManifestSchema>;

export type ParseManifestResult = { ok: true; data: DsfManifest } | { ok: false; error: string };

export function parseManifest(raw: unknown): ParseManifestResult {
  const result = dsfManifestSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? 'Invalid manifest' };
}
