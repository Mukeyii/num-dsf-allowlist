import { deriveStatus, siteOfEmail, validateApproval, ApprovalSig } from '../lib/approvalState';

const NOW = new Date('2026-04-27T12:00:00Z');
const sig = (overrides: Partial<ApprovalSig>): ApprovalSig => ({
  admin_email: 'a@imi.de',
  admin_site: 'imi.de',
  decision: 'APPROVE',
  signed_at: '2026-04-27T11:00:00Z',
  ...overrides,
});

describe('siteOfEmail', () => {
  it('extracts the domain in lowercase', () => {
    expect(siteOfEmail('A@Imi-Test.example.de')).toBe('imi-test.example.de');
  });
  it('returns empty string for malformed input', () => {
    expect(siteOfEmail('no-at-sign')).toBe('');
    expect(siteOfEmail('trailing@')).toBe('');
  });
});

describe('deriveStatus', () => {
  it('PENDING with no signatures', () => {
    expect(deriveStatus([], NOW, 7)).toBe('PENDING');
  });
  it('PENDING with 1 fresh APPROVE', () => {
    expect(deriveStatus([sig({})], NOW, 7)).toBe('PENDING');
  });
  it('APPROVED with 2 APPROVE from different sites', () => {
    expect(deriveStatus(
      [sig({ admin_email: 'a@imi.de', admin_site: 'imi.de' }),
       sig({ admin_email: 'b@charite.de', admin_site: 'charite.de' })],
      NOW, 7,
    )).toBe('APPROVED');
  });
  it('PENDING with 2 APPROVE from same site', () => {
    expect(deriveStatus(
      [sig({ admin_email: 'a@imi.de', admin_site: 'imi.de' }),
       sig({ admin_email: 'b@imi.de', admin_site: 'imi.de' })],
      NOW, 7,
    )).toBe('PENDING');
  });
  it('APPROVED via silent consent after 7 days', () => {
    const old = new Date('2026-04-19T11:00:00Z');
    expect(deriveStatus([sig({ signed_at: old.toISOString() })], NOW, 7)).toBe('APPROVED');
  });
  it('REJECTED short-circuits everything', () => {
    expect(deriveStatus(
      [sig({ admin_email: 'a@imi.de', admin_site: 'imi.de' }),
       sig({ admin_email: 'b@charite.de', admin_site: 'charite.de' }),
       sig({ admin_email: 'c@example.de', admin_site: 'example.de', decision: 'REJECT' })],
      NOW, 7,
    )).toBe('REJECTED');
  });
});

describe('validateApproval', () => {
  it('accepts a clean first approval', () => {
    expect(validateApproval([], 'a@imi.de', 'imi.de')).toBeNull();
  });
  it('rejects same-admin re-approval', () => {
    expect(validateApproval([sig({ admin_email: 'a@imi.de' })], 'a@imi.de', 'imi.de'))
      .toBe('ALREADY_DECIDED');
  });
  it('rejects same-site approval', () => {
    expect(validateApproval([sig({ admin_email: 'a@imi.de', admin_site: 'imi.de' })], 'b@imi.de', 'imi.de'))
      .toBe('ALREADY_APPROVED_SAME_SITE');
  });
  it('accepts different-site second approval', () => {
    expect(validateApproval([sig({ admin_email: 'a@imi.de', admin_site: 'imi.de' })], 'b@charite.de', 'charite.de'))
      .toBeNull();
  });
});
