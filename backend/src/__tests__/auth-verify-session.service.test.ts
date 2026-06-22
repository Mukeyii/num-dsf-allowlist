/**
 * auth-verify-session.service.test.ts — DB + Redis-backed tests for the
 * verification / session-creation flow in auth.service:
 *   • verifyOtpAndGetTempToken: a correct OTP yields a temp token (and signals
 *     whether TOTP setup is required); a wrong OTP is rejected AND consumes the
 *     stored code (single-use), so a follow-up with the real code also fails.
 *   • verifyTotpAndCreateSession: a valid TOTP code mints an access/refresh
 *     pair; a wrong code is rejected with INVALID_TOTP.
 *   • confirmTotpSetupAndCreateSession: a valid confirmation code enables 2FA,
 *     returns a session pair plus 10 backup codes.
 *
 * State is set up directly rather than via requestOtp (which sends mail and is
 * rate-limited): the OTP is stored pre-hashed in Redis the same way the service
 * reads it, and TOTP secrets are provisioned with the service's own
 * saveTotpSecret helper. Each test uses a unique user + unique IP so no
 * rate-limit or row collisions occur across parallel suites.
 *
 * The DEV_TOTP_BYPASS shortcut is forced OFF so verifyTotpCode runs the real
 * decrypt+verify path instead of short-circuiting to true.
 *
 * Dependencies: db/connection, redis.service, otp.service, totp.service,
 * speakeasy, auth.service.
 */
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import speakeasy from 'speakeasy';
import { db } from '../db/connection';
import { setOtp } from '../services/redis.service';
import { saveTotpSecret } from '../services/totp.service';
import {
  verifyOtpAndGetTempToken,
  verifyTotpAndCreateSession,
  confirmTotpSetupAndCreateSession,
  verifyAccessToken,
  verifyTempToken,
} from '../services/auth.service';
import { OTP_TTL_SEC } from '../lib/time';

// Store a 6-digit OTP for `email` the same way otp.service does: SHA-256 hash
// in Redis under `otp:{email}`. Returns the plaintext code the caller verifies.
async function storeOtp(email: string): Promise<string> {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const hashed = crypto.createHash('sha256').update(code).digest('hex');
  await setOtp(email.toLowerCase(), hashed, OTP_TTL_SEC);
  return code;
}

describe('auth.service – verify / session-creation flow', () => {
  let savedAutoLogin: string | undefined;
  let savedBypass: string | undefined;

  beforeAll(() => {
    // Force the dev bypass off so verifyTotpCode runs the real verify path.
    savedAutoLogin = process.env.DEV_AUTO_LOGIN;
    savedBypass = process.env.DEV_TOTP_BYPASS;
    delete process.env.DEV_AUTO_LOGIN;
    delete process.env.DEV_TOTP_BYPASS;
  });

  afterAll(() => {
    if (savedAutoLogin === undefined) delete process.env.DEV_AUTO_LOGIN;
    else process.env.DEV_AUTO_LOGIN = savedAutoLogin;
    if (savedBypass === undefined) delete process.env.DEV_TOTP_BYPASS;
    else process.env.DEV_TOTP_BYPASS = savedBypass;
  });

  // ─── verifyOtpAndGetTempToken ──────────────────────────────────────────────

  describe('verifyOtpAndGetTempToken', () => {
    it('accepts a correct OTP, lazily creates the user, and returns a setup temp token', async () => {
      const email = `otp-ok-${Date.now()}-${uuidv4().slice(0, 8)}@example.de`;
      const code = await storeOtp(email);
      try {
        const { tempToken, requiresTotpSetup } = await verifyOtpAndGetTempToken(
          email,
          code,
          '10.1.0.1',
        );

        // Fresh user has no TOTP yet → must go through setup.
        expect(requiresTotpSetup).toBe(true);
        expect(typeof tempToken).toBe('string');

        // The temp token is a real RS256 token scoped to the setup step.
        const payload = verifyTempToken(tempToken);
        expect(payload.purpose).toBe('totp_setup');
        expect(payload.email).toBe(email.toLowerCase());

        // The user was lazily created in the DB.
        const user = await db('users').where({ email: email.toLowerCase() }).first();
        expect(user).toBeTruthy();
        expect(payload.sub).toBe(user.id);
      } finally {
        await db('users').where({ email: email.toLowerCase() }).del();
      }
    });

    it('returns a totp_required token for a user that already has TOTP enabled', async () => {
      const email = `otp-enabled-${Date.now()}-${uuidv4().slice(0, 8)}@example.de`;
      const userId = uuidv4();
      await db('users').insert({ id: userId, email, totp_enabled: true, created_at: new Date() });
      const code = await storeOtp(email);
      try {
        const { tempToken, requiresTotpSetup } = await verifyOtpAndGetTempToken(
          email,
          code,
          '10.1.0.2',
        );
        expect(requiresTotpSetup).toBe(false);
        expect(verifyTempToken(tempToken).purpose).toBe('totp_required');
      } finally {
        await db('users').where({ id: userId }).del();
      }
    });

    it('rejects a wrong OTP and consumes the stored code (single-use)', async () => {
      const email = `otp-wrong-${Date.now()}-${uuidv4().slice(0, 8)}@example.de`;
      const code = await storeOtp(email);
      try {
        await expect(verifyOtpAndGetTempToken(email, '000000', '10.1.0.3')).rejects.toThrow(
          'INVALID_OTP',
        );

        // The wrong guess already consumed the stored OTP — the real code now
        // fails too, proving at most one attempt per issued code.
        await expect(verifyOtpAndGetTempToken(email, code, '10.1.0.3')).rejects.toThrow(
          'INVALID_OTP',
        );

        // No user should have been created for a failed verification.
        const user = await db('users').where({ email: email.toLowerCase() }).first();
        expect(user).toBeUndefined();
      } finally {
        await db('users').where({ email: email.toLowerCase() }).del();
      }
    });

    it('rejects when no OTP was stored for the email', async () => {
      const email = `otp-none-${Date.now()}-${uuidv4().slice(0, 8)}@example.de`;
      await expect(verifyOtpAndGetTempToken(email, '123456', '10.1.0.4')).rejects.toThrow(
        'INVALID_OTP',
      );
    });
  });

  // ─── verifyTotpAndCreateSession ────────────────────────────────────────────

  describe('verifyTotpAndCreateSession', () => {
    // Seed an enabled user with a known TOTP secret, then mint a real
    // totp_required temp token by going through the OTP step.
    async function seedEnabledUserWithTempToken(): Promise<{
      userId: string;
      email: string;
      secret: string;
      tempToken: string;
    }> {
      const email = `totp-verify-${Date.now()}-${uuidv4().slice(0, 8)}@example.de`;
      const userId = uuidv4();
      await db('users').insert({ id: userId, email, totp_enabled: true, created_at: new Date() });
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      await saveTotpSecret(userId, secret);
      const code = await storeOtp(email);
      const { tempToken } = await verifyOtpAndGetTempToken(email, code, '10.2.0.0');
      return { userId, email, secret, tempToken };
    }

    it('mints an access/refresh pair for a valid TOTP code', async () => {
      const { userId, email, secret, tempToken } = await seedEnabledUserWithTempToken();
      try {
        const totp = speakeasy.totp({ secret, encoding: 'base32' });
        const { accessToken, refreshToken } = await verifyTotpAndCreateSession(
          tempToken,
          totp,
          '10.2.0.1',
        );

        expect(typeof accessToken).toBe('string');
        // Refresh token is a 48-byte hex string (96 hex chars).
        expect(refreshToken).toMatch(/^[0-9a-f]{96}$/);

        // The access token verifies under the RS256 public key and carries the
        // user identity.
        const payload = verifyAccessToken(accessToken);
        expect(payload.sub).toBe(userId);
        expect(payload.email).toBe(email.toLowerCase());

        // last_login was stamped as part of the successful session.
        const user = await db('users').where({ id: userId }).first();
        expect(user.last_login).toBeTruthy();
      } finally {
        await db('users').where({ id: userId }).del();
      }
    });

    it('rejects an invalid TOTP code with INVALID_TOTP', async () => {
      const { userId, tempToken } = await seedEnabledUserWithTempToken();
      try {
        await expect(verifyTotpAndCreateSession(tempToken, '000000', '10.2.0.2')).rejects.toThrow(
          'INVALID_TOTP',
        );
      } finally {
        await db('users').where({ id: userId }).del();
      }
    });

    it('rejects a setup-purpose temp token with INVALID_TOKEN_PURPOSE', async () => {
      // A brand-new (TOTP-disabled) user yields a totp_setup token, which is the
      // wrong purpose for this step.
      const email = `totp-purpose-${Date.now()}-${uuidv4().slice(0, 8)}@example.de`;
      const code = await storeOtp(email);
      try {
        const { tempToken } = await verifyOtpAndGetTempToken(email, code, '10.2.0.3');
        await expect(verifyTotpAndCreateSession(tempToken, '123456', '10.2.0.3')).rejects.toThrow(
          'INVALID_TOKEN_PURPOSE',
        );
      } finally {
        await db('users').where({ email: email.toLowerCase() }).del();
      }
    });
  });

  // ─── confirmTotpSetupAndCreateSession ──────────────────────────────────────

  describe('confirmTotpSetupAndCreateSession', () => {
    it('enables TOTP, returns a session pair and 10 backup codes for a valid code', async () => {
      // Fresh user (totp_enabled defaults false) with a provisioned secret.
      const email = `totp-setup-${Date.now()}-${uuidv4().slice(0, 8)}@example.de`;
      const userId = uuidv4();
      await db('users').insert({ id: userId, email, totp_enabled: false, created_at: new Date() });
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      await saveTotpSecret(userId, secret);

      // OTP step mints a totp_setup temp token (user has TOTP disabled).
      const code = await storeOtp(email);
      const { tempToken, requiresTotpSetup } = await verifyOtpAndGetTempToken(
        email,
        code,
        '10.3.0.1',
      );
      expect(requiresTotpSetup).toBe(true);

      try {
        const totp = speakeasy.totp({ secret, encoding: 'base32' });
        const result = await confirmTotpSetupAndCreateSession(tempToken, totp, '10.3.0.1');

        expect(result.refreshToken).toMatch(/^[0-9a-f]{96}$/);
        expect(verifyAccessToken(result.accessToken).sub).toBe(userId);

        // Exactly 10 distinct upper-case-hex backup codes are handed back once.
        expect(result.backupCodes).toHaveLength(10);
        for (const c of result.backupCodes) expect(c).toMatch(/^[0-9A-F]{8}$/);
        expect(new Set(result.backupCodes).size).toBe(10);

        // 2FA is now flagged enabled in the DB.
        const user = await db('users').where({ id: userId }).first();
        expect(Boolean(user.totp_enabled)).toBe(true);
      } finally {
        await db('users').where({ id: userId }).del();
      }
    });

    it('rejects an invalid confirmation code with INVALID_TOTP_CODE and does not enable TOTP', async () => {
      const email = `totp-setup-bad-${Date.now()}-${uuidv4().slice(0, 8)}@example.de`;
      const userId = uuidv4();
      await db('users').insert({ id: userId, email, totp_enabled: false, created_at: new Date() });
      const secret = speakeasy.generateSecret({ length: 20 }).base32;
      await saveTotpSecret(userId, secret);
      const code = await storeOtp(email);
      const { tempToken } = await verifyOtpAndGetTempToken(email, code, '10.3.0.2');

      try {
        await expect(
          confirmTotpSetupAndCreateSession(tempToken, '000000', '10.3.0.2'),
        ).rejects.toThrow('INVALID_TOTP_CODE');

        // 2FA must remain disabled after a failed confirmation.
        const user = await db('users').where({ id: userId }).first();
        expect(Boolean(user.totp_enabled)).toBe(false);
      } finally {
        await db('users').where({ id: userId }).del();
      }
    });
  });
});
