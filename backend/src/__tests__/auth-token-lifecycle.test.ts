/**
 * auth-token-lifecycle.test.ts — token-lifecycle surface of auth.service.
 *
 * Covers the create → verify → refresh → revoke flow against the real test DB
 * and Redis (refresh tokens are keyed `refresh:<sha256(plaintext)>`):
 *   • createTokenPair signs an RS256 access token verifyAccessToken accepts,
 *     returns the PLAINTEXT refresh token, and stores only its SHA-256 hash in
 *     Redis (a DB dump of `refresh:*` never yields a usable token).
 *   • verifyAccessToken / verifyTempToken accept a freshly signed token and
 *     reject a tampered or wrong-key one.
 *   • refreshAccessToken rotates a valid stored token (old hash gone, new pair
 *     issued, new hash stored) and rejects an unknown / revoked token.
 *   • logout deletes the refresh token so a later refresh fails.
 *   • revokeAllSessions invalidates every refresh token for the user and leaves
 *     a second user's session untouched.
 *
 * The idle-timeout `SESSION_EXPIRED` branch in refreshAccessToken is gated on
 * NODE_ENV !== 'test', so this suite must run with NODE_ENV=test (the package
 * `test` script sets it; the refresh-lock suite relies on the same).
 *
 * Dependencies: db/connection, redis.service, jsonwebtoken, auth.service.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { redis } from '../services/redis.service';
import {
  createTokenPair,
  verifyAccessToken,
  verifyTempToken,
  refreshAccessToken,
  logout,
  revokeAllSessions,
} from '../services/auth.service';

const JWT_PRIVATE_KEY = Buffer.from(process.env.JWT_PRIVATE_KEY_BASE64 || '', 'base64').toString(
  'utf8',
);

const refreshKey = (token: string): string =>
  `refresh:${crypto.createHash('sha256').update(token).digest('hex')}`;

describe('auth.service – token lifecycle', () => {
  const userId = uuidv4();
  const email = `token-lifecycle-${Date.now()}@example.de`;
  // Track every plaintext refresh token we mint so we can purge their Redis
  // keys in afterAll regardless of which assertion path created them.
  const minted: string[] = [];

  const mint = async (): Promise<{ accessToken: string; refreshToken: string }> => {
    const pair = await createTokenPair({ id: userId, email, totpEnabled: true });
    minted.push(pair.refreshToken);
    return pair;
  };

  beforeAll(async () => {
    await db('users').insert({ id: userId, email, totp_enabled: true, created_at: new Date() });
    await db('email_whitelist').insert({ id: uuidv4(), email, created_at: new Date() });
  });

  afterAll(async () => {
    const keys = minted.map(refreshKey);
    if (keys.length) await redis.del(...keys);
    await db('email_whitelist').where({ email }).del();
    await db('users').where({ id: userId }).del();
  });

  describe('createTokenPair', () => {
    it('signs an RS256 access token whose claims match the user', async () => {
      const { accessToken } = await mint();
      const payload = verifyAccessToken(accessToken);
      expect(payload.sub).toBe(userId);
      expect(payload.email).toBe(email);
      // RS256 header alg — never HS256.
      const header = JSON.parse(Buffer.from(accessToken.split('.')[0], 'base64').toString('utf8'));
      expect(header.alg).toBe('RS256');
    });

    it('returns a plaintext refresh token but stores only its sha256 hash in Redis', async () => {
      const { refreshToken } = await mint();
      // The plaintext itself is NOT a Redis key…
      expect(await redis.get(`refresh:${refreshToken}`)).toBeNull();
      // …its hash is, and it maps back to the user id.
      const stored = await redis.get(refreshKey(refreshToken));
      expect(stored).toBe(userId);
    });
  });

  describe('verifyAccessToken', () => {
    it('rejects a token whose payload byte was flipped', async () => {
      const { accessToken } = await mint();
      const [h, p, s] = accessToken.split('.');
      // Mutate one base64url char of the payload segment → signature no longer matches.
      const flipped = p[0] === 'A' ? 'B' : 'A';
      const tampered = `${h}.${flipped}${p.slice(1)}.${s}`;
      expect(() => verifyAccessToken(tampered)).toThrow();
    });

    it('rejects an already-expired token', () => {
      const expired = jwt.sign({ sub: userId, email }, JWT_PRIVATE_KEY, {
        algorithm: 'RS256',
        expiresIn: '-1m',
      });
      expect(() => verifyAccessToken(expired)).toThrow(jwt.TokenExpiredError);
    });
  });

  describe('verifyTempToken', () => {
    it('accepts a freshly signed temp token and exposes its purpose', () => {
      const tempToken = jwt.sign(
        { sub: userId, email, purpose: 'totp_required' },
        JWT_PRIVATE_KEY,
        {
          algorithm: 'RS256',
          expiresIn: '10m',
        },
      );
      const payload = verifyTempToken(tempToken);
      expect(payload.sub).toBe(userId);
      expect(payload.purpose).toBe('totp_required');
    });

    it('rejects a temp token signed with the wrong key', () => {
      // A throwaway RSA key the public verify key will not validate against.
      const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const forged = jwt.sign(
        { sub: userId, email, purpose: 'totp_required' },
        privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
        { algorithm: 'RS256', expiresIn: '10m' },
      );
      expect(() => verifyTempToken(forged)).toThrow();
    });
  });

  describe('refreshAccessToken', () => {
    it('rotates: deletes the old token and stores a fresh, different one', async () => {
      const { refreshToken: oldToken } = await mint();
      const rotated = await refreshAccessToken(oldToken);
      minted.push(rotated.refreshToken);

      expect(rotated.accessToken).toBeTruthy();
      expect(rotated.refreshToken).toBeTruthy();
      expect(rotated.refreshToken).not.toBe(oldToken);

      // Old hash is gone; the new one resolves to this user.
      expect(await redis.get(refreshKey(oldToken))).toBeNull();
      expect(await redis.get(refreshKey(rotated.refreshToken))).toBe(userId);

      // The rotated access token is itself valid.
      expect(verifyAccessToken(rotated.accessToken).sub).toBe(userId);
    });

    it('rejects an unknown refresh token', async () => {
      const unknown = crypto.randomBytes(48).toString('hex');
      await expect(refreshAccessToken(unknown)).rejects.toThrow('INVALID_REFRESH_TOKEN');
    });

    it('rejects a token that was already rotated away (single-use)', async () => {
      const { refreshToken } = await mint();
      const rotated = await refreshAccessToken(refreshToken);
      minted.push(rotated.refreshToken);
      // Re-presenting the consumed original must fail.
      await expect(refreshAccessToken(refreshToken)).rejects.toThrow('INVALID_REFRESH_TOKEN');
    });
  });

  describe('logout', () => {
    it('revokes the refresh token so a subsequent refresh fails', async () => {
      const { refreshToken } = await mint();
      await logout(refreshToken, email, '127.0.0.1');
      expect(await redis.get(refreshKey(refreshToken))).toBeNull();
      await expect(refreshAccessToken(refreshToken)).rejects.toThrow('INVALID_REFRESH_TOKEN');
    });
  });

  describe('revokeAllSessions', () => {
    it('invalidates every refresh token for the user and reports the count', async () => {
      // Three live sessions for our user.
      const a = await mint();
      const b = await mint();
      const c = await mint();

      const revoked = await revokeAllSessions(email);
      expect(revoked).toBeGreaterThanOrEqual(3);

      for (const t of [a, b, c]) {
        expect(await redis.get(refreshKey(t.refreshToken))).toBeNull();
        await expect(refreshAccessToken(t.refreshToken)).rejects.toThrow('INVALID_REFRESH_TOKEN');
      }
    });

    it('leaves another user’s sessions untouched', async () => {
      const otherId = uuidv4();
      const otherEmail = `token-lifecycle-other-${Date.now()}@example.de`;
      await db('users').insert({
        id: otherId,
        email: otherEmail,
        totp_enabled: true,
        created_at: new Date(),
      });
      const otherPair = await createTokenPair({
        id: otherId,
        email: otherEmail,
        totpEnabled: true,
      });
      const mineToRevoke = await mint();

      try {
        await revokeAllSessions(email);
        // Mine is gone…
        expect(await redis.get(refreshKey(mineToRevoke.refreshToken))).toBeNull();
        // …the other user's token survives.
        expect(await redis.get(refreshKey(otherPair.refreshToken))).toBe(otherId);
      } finally {
        await redis.del(refreshKey(otherPair.refreshToken));
        await db('users').where({ id: otherId }).del();
      }
    });

    it('returns 0 for an unknown email', async () => {
      expect(await revokeAllSessions(`nobody-${Date.now()}@example.de`)).toBe(0);
    });
  });
});
