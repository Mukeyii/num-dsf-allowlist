/**
 * totp-bypass-gate.test.ts — the DEV_TOTP_BYPASS short-circuit in
 * verifyTotpCode must fire ONLY when NODE_ENV is on the development/test
 * allowlist. An unrecognized NODE_ENV (e.g. 'staging') must NOT activate the
 * bypass even when both DEV_AUTO_LOGIN and DEV_TOTP_BYPASS are 'true' —
 * otherwise a misconfigured preview/staging deploy would silently disable
 * admin step-up TOTP. With the bypass inactive, verifyTotpCode falls through
 * to the real check, which returns false for a user that has no TOTP secret.
 *
 * Dependencies: db/connection, totp.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { verifyTotpCode } from '../services/totp.service';

describe('verifyTotpCode – DEV_TOTP_BYPASS env gating', () => {
  const userId = uuidv4();
  const email = `totp-bypass-gate-${Date.now()}@example.de`;
  let savedNodeEnv: string | undefined;
  let savedAutoLogin: string | undefined;
  let savedBypass: string | undefined;

  beforeAll(async () => {
    // User row with NO totp_secret, so the real path can only return false.
    await db('users').insert({ id: userId, email, totp_enabled: true, created_at: new Date() });
    savedNodeEnv = process.env.NODE_ENV;
    savedAutoLogin = process.env.DEV_AUTO_LOGIN;
    savedBypass = process.env.DEV_TOTP_BYPASS;
  });

  afterAll(async () => {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    if (savedAutoLogin === undefined) delete process.env.DEV_AUTO_LOGIN;
    else process.env.DEV_AUTO_LOGIN = savedAutoLogin;
    if (savedBypass === undefined) delete process.env.DEV_TOTP_BYPASS;
    else process.env.DEV_TOTP_BYPASS = savedBypass;
    await db('users').where({ id: userId }).del();
  });

  it('does NOT bypass under an unrecognized NODE_ENV even with both flags true', async () => {
    process.env.NODE_ENV = 'staging';
    process.env.DEV_AUTO_LOGIN = 'true';
    process.env.DEV_TOTP_BYPASS = 'true';

    // Bypass must be inactive → real check runs → no secret → false.
    expect(await verifyTotpCode(userId, '000000')).toBe(false);
  });
});
