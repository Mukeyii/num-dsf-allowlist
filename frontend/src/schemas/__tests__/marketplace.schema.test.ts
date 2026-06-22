/**
 * marketplace.schema.test.ts — pure validation tests for the marketplace add/edit
 * form schemas. Covers the git-URL regex refinement, status enum, the 6-digit
 * TOTP length rule, and the optional fields on the edit schema.
 */
import { describe, it, expect } from 'vitest';
import { marketplaceAddFormSchema, marketplaceEditFormSchema } from '../marketplace.schema';

describe('marketplaceAddFormSchema', () => {
  it('accepts a well-formed GitHub URL and passes the values through', () => {
    const res = marketplaceAddFormSchema.safeParse({
      gitUrl: 'https://github.com/medizininformatik-initiative/dsf-process',
      status: 'EXPERIMENTAL',
      totpCode: '123456',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.gitUrl).toBe('https://github.com/medizininformatik-initiative/dsf-process');
      expect(res.data.status).toBe('EXPERIMENTAL');
      expect(res.data.totpCode).toBe('123456');
    }
  });

  it('accepts a URL with a trailing .git suffix', () => {
    const res = marketplaceAddFormSchema.safeParse({
      gitUrl: 'https://github.com/owner/repo.git',
      totpCode: '000000',
    });
    expect(res.success).toBe(true);
  });

  it('defaults status to APPROVED when omitted', () => {
    const res = marketplaceAddFormSchema.safeParse({
      gitUrl: 'https://github.com/owner/repo',
      totpCode: '654321',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.status).toBe('APPROVED');
    }
  });

  it('rejects a non-GitHub URL with the marketplaceInvalidUrl message on gitUrl', () => {
    const res = marketplaceAddFormSchema.safeParse({
      gitUrl: 'https://gitlab.com/owner/repo',
      totpCode: '123456',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path[0] === 'gitUrl');
      expect(issue?.message).toBe('marketplaceInvalidUrl');
    }
  });

  it('rejects an http (non-https) GitHub URL', () => {
    const res = marketplaceAddFormSchema.safeParse({
      gitUrl: 'http://github.com/owner/repo',
      totpCode: '123456',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === 'gitUrl')).toBe(true);
    }
  });

  it('rejects a GitHub URL missing the repo segment', () => {
    const res = marketplaceAddFormSchema.safeParse({
      gitUrl: 'https://github.com/owner',
      totpCode: '123456',
    });
    expect(res.success).toBe(false);
  });

  it('rejects an invalid status enum value', () => {
    const res = marketplaceAddFormSchema.safeParse({
      gitUrl: 'https://github.com/owner/repo',
      status: 'PENDING',
      totpCode: '123456',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === 'status')).toBe(true);
    }
  });

  it('rejects a TOTP code that is not exactly 6 chars with totpDigitsRequired', () => {
    const res = marketplaceAddFormSchema.safeParse({
      gitUrl: 'https://github.com/owner/repo',
      totpCode: '123',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path[0] === 'totpCode');
      expect(issue?.message).toBe('totpDigitsRequired');
    }
  });

  it('rejects when gitUrl is missing entirely', () => {
    const res = marketplaceAddFormSchema.safeParse({ totpCode: '123456' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === 'gitUrl')).toBe(true);
    }
  });
});

describe('marketplaceEditFormSchema', () => {
  it('accepts a minimal payload with only status and totpCode', () => {
    const res = marketplaceEditFormSchema.safeParse({
      status: 'APPROVED',
      totpCode: '123456',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.status).toBe('APPROVED');
      expect(res.data.totpCode).toBe('123456');
    }
  });

  it('accepts the full set of optional text/array fields', () => {
    const res = marketplaceEditFormSchema.safeParse({
      status: 'DEPRECATED',
      verified: true,
      advisoryText: 'Use the successor process instead.',
      advisorySeverity: 'WARNING',
      supersededBy: 'new-slug',
      processIdentifiers: 'a,b,c',
      dsfVersionMin: '1.0.0',
      requiredRoles: 'DIC,HRP',
      messageNames: 'startProcess',
      artifactUrl: 'https://example.org/artifact.jar',
      totpCode: '999999',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.verified).toBe(true);
      expect(res.data.advisorySeverity).toBe('WARNING');
      expect(res.data.processIdentifiers).toBe('a,b,c');
    }
  });

  it('accepts an empty-string advisorySeverity (the unset sentinel)', () => {
    const res = marketplaceEditFormSchema.safeParse({
      status: 'APPROVED',
      advisorySeverity: '',
      totpCode: '123456',
    });
    expect(res.success).toBe(true);
  });

  it('rejects an out-of-range advisorySeverity enum value', () => {
    const res = marketplaceEditFormSchema.safeParse({
      status: 'APPROVED',
      advisorySeverity: 'FATAL',
      totpCode: '123456',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === 'advisorySeverity')).toBe(true);
    }
  });

  it('rejects an invalid status enum value', () => {
    const res = marketplaceEditFormSchema.safeParse({
      status: 'ARCHIVED',
      totpCode: '123456',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === 'status')).toBe(true);
    }
  });

  it('rejects a short TOTP code with totpDigitsRequired on totpCode', () => {
    const res = marketplaceEditFormSchema.safeParse({
      status: 'APPROVED',
      totpCode: '12',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path[0] === 'totpCode');
      expect(issue?.message).toBe('totpDigitsRequired');
    }
  });

  it('rejects when status is missing entirely', () => {
    const res = marketplaceEditFormSchema.safeParse({ totpCode: '123456' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === 'status')).toBe(true);
    }
  });
});
