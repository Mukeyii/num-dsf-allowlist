import { signGrant, verifyGrant, canonicalMessage } from '../lib/adminGrants';

describe('admin grant signing', () => {
  const email = 'admin@imi.de';
  const grantedAt = new Date('2026-04-28T10:00:00Z');
  const a = 'first@imi.de';
  const b = 'second@charite.de';

  it('signs and verifies a valid grant', () => {
    const sig = signGrant(email, grantedAt, a, b);
    expect(
      verifyGrant({
        email,
        granted_at: grantedAt,
        granted_by_a: a,
        granted_by_b: b,
        signature_hex: sig,
      }),
    ).toBe(true);
  });

  it('rejects a forged signature', () => {
    expect(
      verifyGrant({
        email,
        granted_at: grantedAt,
        granted_by_a: a,
        granted_by_b: b,
        signature_hex: '00'.repeat(256),
      }),
    ).toBe(false);
  });

  it('rejects a tampered email', () => {
    const sig = signGrant(email, grantedAt, a, b);
    expect(
      verifyGrant({
        email: 'evil@attacker.de',
        granted_at: grantedAt,
        granted_by_a: a,
        granted_by_b: b,
        signature_hex: sig,
      }),
    ).toBe(false);
  });

  it('rejects a tampered approver', () => {
    const sig = signGrant(email, grantedAt, a, b);
    expect(
      verifyGrant({
        email,
        granted_at: grantedAt,
        granted_by_a: 'attacker@imi.de',
        granted_by_b: b,
        signature_hex: sig,
      }),
    ).toBe(false);
  });

  it('canonical message is case-insensitive on emails', () => {
    expect(canonicalMessage('A@IMI.de', grantedAt, 'B@CHARITE.de', 'C@example.de')).toBe(
      canonicalMessage('a@imi.de', grantedAt, 'b@charite.de', 'c@example.de'),
    );
  });

  it('survives MySQL TIMESTAMP round-trip (sub-second truncation)', () => {
    // MySQL TIMESTAMP stores whole seconds. If we sign with a millisecond-
    // precision Date and the DB hands back a truncated one, verifyGrant
    // would fail. Signers must round to seconds before signing.
    const wholeSecond = new Date(Math.floor(Date.now() / 1000) * 1000);
    const sig = signGrant(email, wholeSecond, a, b);
    // Simulate what MySQL hands back: the same instant with ms = 0.
    const fromDb = new Date(Math.floor(wholeSecond.getTime() / 1000) * 1000);
    expect(
      verifyGrant({
        email,
        granted_at: fromDb,
        granted_by_a: a,
        granted_by_b: b,
        signature_hex: sig,
      }),
    ).toBe(true);

    // Demonstrate the failure mode: signing with sub-second precision and
    // verifying after truncation must NOT verify.
    const subSecond = new Date(wholeSecond.getTime() + 123);
    const sigSub = signGrant(email, subSecond, a, b);
    expect(
      verifyGrant({
        email,
        granted_at: fromDb,
        granted_by_a: a,
        granted_by_b: b,
        signature_hex: sigSub,
      }),
    ).toBe(false);
  });
});
