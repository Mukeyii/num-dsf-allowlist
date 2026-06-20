/**
 * totp-crypto.test.ts — exercises the TOTP service's pure crypto surface:
 *   • saveTotpSecret encrypts the secret (AES-256-GCM) and verifyTotpCode
 *     decrypts it again, so a code freshly minted with speakeasy against the
 *     plaintext secret verifies true — proving the encrypt→decrypt round-trip.
 *   • a wrong code against a real stored secret verifies false.
 *   • generateTotpSetup returns a base32 secret and a data-URL QR code.
 *   • generateBackupCodes returns 10 distinct upper-case-hex codes.
 *
 * The DEV_TOTP_BYPASS shortcut is forced OFF here (the dev container sets it
 * on) so the real verify path runs instead of short-circuiting to true.
 *
 * Dependencies: db/connection, redis, speakeasy, totp.service.
 */
import { v4 as uuidv4 } from 'uuid';
import speakeasy from 'speakeasy';
import { db } from '../db/connection';
import {
  saveTotpSecret,
  verifyTotpCode,
  generateTotpSetup,
  generateBackupCodes,
} from '../services/totp.service';

describe('totp.service crypto', () => {
  const userId = uuidv4();
  const email = `totp-crypto-${Date.now()}@example.de`;
  let savedAutoLogin: string | undefined;
  let savedBypass: string | undefined;

  beforeAll(async () => {
    // Force the dev bypass off so verifyTotpCode runs the real decrypt+verify.
    savedAutoLogin = process.env.DEV_AUTO_LOGIN;
    savedBypass = process.env.DEV_TOTP_BYPASS;
    delete process.env.DEV_AUTO_LOGIN;
    delete process.env.DEV_TOTP_BYPASS;
    await db('users').insert({ id: userId, email, totp_enabled: true, created_at: new Date() });
  });

  afterAll(async () => {
    if (savedAutoLogin === undefined) delete process.env.DEV_AUTO_LOGIN;
    else process.env.DEV_AUTO_LOGIN = savedAutoLogin;
    if (savedBypass === undefined) delete process.env.DEV_TOTP_BYPASS;
    else process.env.DEV_TOTP_BYPASS = savedBypass;
    await db('users').where({ id: userId }).del();
  });

  it('verifies a fresh code against an encrypted-then-decrypted secret', async () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    await saveTotpSecret(userId, secret); // encrypts (AES-256-GCM) into the DB
    const code = speakeasy.totp({ secret, encoding: 'base32' });
    // verifyTotpCode must decrypt the stored secret and accept the code.
    expect(await verifyTotpCode(userId, code)).toBe(true);
  });

  it('rejects a wrong code against a real stored secret', async () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;
    await saveTotpSecret(userId, secret);
    // '000000' is overwhelmingly unlikely to be the current step's code.
    expect(await verifyTotpCode(userId, '000000')).toBe(false);
  });

  it('generateTotpSetup returns a base32 secret and a PNG data-URL QR code', async () => {
    const { secret, qrCodeUrl } = await generateTotpSetup('user@example.de');
    expect(secret).toMatch(/^[A-Z2-7]+$/); // RFC 4648 base32 alphabet
    expect(secret.length).toBeGreaterThan(0);
    expect(qrCodeUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('generateBackupCodes returns 10 distinct upper-case-hex codes', async () => {
    const codes = await generateBackupCodes(userId);
    expect(codes).toHaveLength(10);
    for (const c of codes) expect(c).toMatch(/^[0-9A-F]{8}$/);
    expect(new Set(codes).size).toBe(10); // no duplicates
  });
});
