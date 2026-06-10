/**
 * auth-refresh-lock.test.ts — refreshAccessToken must refuse to rotate a
 * session for an account that was locked or removed from the whitelist, so a
 * locked admin cannot keep a 7-day refresh token alive indefinitely (the
 * stateless access token already expires within JWT_EXPIRES_IN). Uses DB +
 * Redis. The idle-timeout check is skipped under NODE_ENV=test.
 *
 * Dependencies: db/connection, auth.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { createTokenPair, refreshAccessToken } from '../services/auth.service';

describe('auth.service – refreshAccessToken lock enforcement', () => {
  const userId = uuidv4();
  const email = `refresh-lock-${Date.now()}@example.de`;

  beforeAll(async () => {
    await db('users').insert({ id: userId, email, totp_enabled: true, created_at: new Date() });
    await db('email_whitelist').insert({ id: uuidv4(), email, created_at: new Date() });
  });

  afterAll(async () => {
    await db('email_whitelist').where({ email }).del();
    await db('users').where({ id: userId }).del();
  });

  it('rotates while the account is whitelisted and unlocked', async () => {
    const { refreshToken } = await createTokenPair({ id: userId, email, totpEnabled: true });
    const rotated = await refreshAccessToken(refreshToken);
    expect(rotated.accessToken).toBeTruthy();
    expect(rotated.refreshToken).toBeTruthy();
  });

  it('refuses to rotate once the account is locked', async () => {
    const { refreshToken } = await createTokenPair({ id: userId, email, totpEnabled: true });
    await db('email_whitelist').where({ email }).update({ locked_at: new Date() });
    try {
      await expect(refreshAccessToken(refreshToken)).rejects.toThrow('ACCOUNT_LOCKED');
    } finally {
      await db('email_whitelist').where({ email }).update({ locked_at: null });
    }
  });

  it('refuses to rotate once the account is de-whitelisted', async () => {
    const { refreshToken } = await createTokenPair({ id: userId, email, totpEnabled: true });
    await db('email_whitelist').where({ email }).del();
    try {
      await expect(refreshAccessToken(refreshToken)).rejects.toThrow('ACCOUNT_LOCKED');
    } finally {
      // Restore so afterAll's symmetric cleanup is a no-op surprise-free.
      await db('email_whitelist').insert({ id: uuidv4(), email, created_at: new Date() });
    }
  });
});
