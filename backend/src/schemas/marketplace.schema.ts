/**
 * marketplace.schema.ts – Zod validation for marketplace endpoints
 */
import { z } from 'zod';
import { dsfManifestSchema } from './marketplace-manifest.schema';

const STATUS = z.enum(['APPROVED', 'EXPERIMENTAL', 'DEPRECATED']);

const ADVISORY_SEVERITY = z.enum(['INFO', 'WARNING', 'CRITICAL']);

const githubUrlRegex = /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(?:\.git)?\/?$/;

export const createMarketplaceSchema = z.object({
  gitUrl: z.string().regex(githubUrlRegex, 'Must be a https://github.com/owner/repo URL'),
  status: STATUS.optional().default('APPROVED'),
  totpCode: z.string().length(6),
});

export const patchMarketplaceSchema = z.object({
  status: STATUS,
  totpCode: z.string().length(6),
});

export const deleteMarketplaceSchema = z.object({
  totpCode: z.string().length(6),
});

/**
 * Normalize a GitHub URL to canonical https://github.com/{owner}/{repo} form.
 * Caller must have already validated the input matches githubUrlRegex.
 */
export function normalizeGithubUrl(input: string): {
  canonical: string;
  owner: string;
  repo: string;
} {
  const m = input.match(
    /^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/,
  );
  if (!m) throw new Error('INVALID_GITHUB_URL');
  const [, owner, repo] = m;
  return { canonical: `https://github.com/${owner}/${repo}`, owner, repo };
}

/**
 * Build the URL slug for a process from its owner/repo. Lowercased so lookups
 * are case-insensitive and stable against GitHub's case-preserving paths.
 */
export function slugify(owner: string, repo: string): string {
  return `${owner}-${repo}`.toLowerCase();
}

/**
 * Admin patch for DSF + trust metadata. The DSF fields reuse the manifest
 * validators verbatim (dsfManifestSchema.shape) so manual edits and parsed
 * manifests share one contract. advisory/superseded are nullable so a field
 * can be cleared.
 */
export const patchMarketplaceMetaSchema = z.object({
  ...dsfManifestSchema.shape,
  status: STATUS.optional(),
  verified: z.boolean().optional(),
  advisoryText: z.string().nullable().optional(),
  advisorySeverity: ADVISORY_SEVERITY.nullable().optional(),
  supersededBy: z.string().nullable().optional(),
  totpCode: z.string().length(6),
});
