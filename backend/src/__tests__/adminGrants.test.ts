import { signGrant, verifyGrant, canonicalMessage } from '../lib/adminGrants';

describe('admin grant signing', () => {
  const email = 'admin@imi.de';
  const grantedAt = new Date('2026-04-28T10:00:00Z');
  const a = 'first@imi.de';
  const b = 'second@charite.de';

  it('signs and verifies a valid grant', () => {
    const sig = signGrant(email, grantedAt, a, b);
    expect(verifyGrant({ email, granted_at: grantedAt, granted_by_a: a, granted_by_b: b, signature_hex: sig })).toBe(true);
  });

  it('rejects a forged signature', () => {
    expect(verifyGrant({ email, granted_at: grantedAt, granted_by_a: a, granted_by_b: b, signature_hex: '00'.repeat(256) })).toBe(false);
  });

  it('rejects a tampered email', () => {
    const sig = signGrant(email, grantedAt, a, b);
    expect(verifyGrant({ email: 'evil@attacker.de', granted_at: grantedAt, granted_by_a: a, granted_by_b: b, signature_hex: sig })).toBe(false);
  });

  it('rejects a tampered approver', () => {
    const sig = signGrant(email, grantedAt, a, b);
    expect(verifyGrant({ email, granted_at: grantedAt, granted_by_a: 'attacker@imi.de', granted_by_b: b, signature_hex: sig })).toBe(false);
  });

  it('canonical message is case-insensitive on emails', () => {
    expect(canonicalMessage('A@IMI.de', grantedAt, 'B@CHARITE.de', 'C@example.de'))
      .toBe(canonicalMessage('a@imi.de', grantedAt, 'b@charite.de', 'c@example.de'));
  });
});
