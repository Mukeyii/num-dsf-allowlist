/**
 * totp-anti-replay.test.ts — security regression: a valid TOTP code, once
 * accepted, must be rejected on a second use within the anti-replay window.
 * Uses DB (encrypted secret) + Redis (replay claim). The DEV_TOTP_BYPASS
 * shortcut must be off for this to be meaningful — CI's backend-test job does
 * not set it, and the test asserts the real path.
 */
import { v4 as uuidv4 } from 'uuid';
import speakeasy from 'speakeasy';
import { db } from '../db/connection';
import { saveTotpSecret, verifyTotpCode } from '../services/totp.service';

describe('TOTP anti-replay', () => {
  const bypassOn =
    process.env.NODE_ENV !== 'production' &&
    process.env.DEV_AUTO_LOGIN === 'true' &&
    process.env.DEV_TOTP_BYPASS === 'true';

  (bypassOn ? it.skip : it)('rejects a valid code reused within the replay window', async () => {
    const userId = uuidv4();
    const email = `totp-replay-${Date.now()}@example.de`;
    await db('users').insert({ id: userId, email, totp_enabled: true, created_at: new Date() });
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    await saveTotpSecret(userId, secret);

    const code = speakeasy.totp({ secret, encoding: 'base32' });

    try {
      expect(await verifyTotpCode(userId, code)).toBe(true); // first use accepted
      expect(await verifyTotpCode(userId, code)).toBe(false); // replay rejected
    } finally {
      await db('users').where({ id: userId }).del();
    }
  });

  (bypassOn ? it.skip : it)(
    'rejects a reused code resubmitted with different whitespace',
    async () => {
      const userId = uuidv4();
      const email = `totp-replay-ws-${Date.now()}@example.de`;
      await db('users').insert({ id: userId, email, totp_enabled: true, created_at: new Date() });
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      await saveTotpSecret(userId, secret);

      const code = speakeasy.totp({ secret, encoding: 'base32' });

      try {
        // First use of the bare code is accepted and claimed.
        expect(await verifyTotpCode(userId, code)).toBe(true);
        // The same code with embedded spaces normalizes to the same token —
        // it must hit the same replay claim and be rejected, not slip through.
        const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
        expect(await verifyTotpCode(userId, spaced)).toBe(false);
      } finally {
        await db('users').where({ id: userId }).del();
      }
    },
  );

  (bypassOn ? it.skip : it)('rejects a wrong code outright', async () => {
    const userId = uuidv4();
    const email = `totp-wrong-${Date.now()}@example.de`;
    await db('users').insert({ id: userId, email, totp_enabled: true, created_at: new Date() });
    await saveTotpSecret(userId, speakeasy.generateSecret({ length: 20 }).base32);
    try {
      expect(await verifyTotpCode(userId, '000000')).toBe(false);
    } finally {
      await db('users').where({ id: userId }).del();
    }
  });
});
