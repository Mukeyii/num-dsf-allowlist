/**
 * marketplace.schema.ts – Zod validation for marketplace endpoints
 */
import { z } from 'zod';

const STATUS = z.enum(['APPROVED', 'EXPERIMENTAL', 'DEPRECATED']);

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
export function normalizeGithubUrl(input: string): { canonical: string; owner: string; repo: string } {
  const m = input.match(/^https:\/\/github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/);
  if (!m) throw new Error('INVALID_GITHUB_URL');
  const [, owner, repo] = m;
  return { canonical: `https://github.com/${owner}/${repo}`, owner, repo };
}
