/**
 * auth-request-otp.service.test.ts — DB + Redis-backed tests for the
 * requestOtp step in auth.service (the OTP-request path).
 *
 * Covers:
 *   • Whitelisted email → an OTP is stored SHA-256-hashed under `otp:{email}`
 *     in Redis (the stored value is a 64-char hex hash, NOT the plaintext code),
 *     and mail.sendOtpEmail is invoked once with that same email and a 6-digit
 *     code. The captured plaintext code hashes to exactly the value Redis holds.
 *   • Non-whitelisted email → requestOtp throws the generic NOT_WHITELISTED,
 *     sends no mail, and writes no `otp:*` key (no enumeration / timing leak via
 *     a stored code or a mail send).
 *   • A locked whitelist entry is treated identically to a missing one.
 *
 * The mail service is mocked so no SMTP is attempted; the real otp.service +
 * Redis path runs so the hashing/storage contract is exercised end-to-end.
 *
 * Per-IP rate limiting is NOT enforced inside requestOtp — it lives in the
 * express-rate-limit middleware on /auth/request-otp (covered by
 * rateLimit.middleware.test). Each case uses a unique email + unique IP so no
 * row or rate-limit collisions occur across parallel suites.
 *
 * Dependencies: db/connection, redis.service, mail.service (mocked), auth.service.
 */
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Mock the mail service so requestOtp's fire-and-forget send hits a spy, not SMTP.
jest.mock('../services/mail.service', () => ({
  __esModule: true,
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
}));

import { db } from '../db/connection';
import { redis } from '../services/redis.service';
import { sendOtpEmail } from '../services/mail.service';
import { requestOtp } from '../services/auth.service';

const sendOtpEmailMock = sendOtpEmail as jest.MockedFunction<typeof sendOtpEmail>;

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

describe('auth.service – requestOtp', () => {
  const suffix = uuidv4().slice(0, 8);
  const whitelisted = `req-otp-ok-${suffix}@example.de`;
  const lockedEmail = `req-otp-locked-${suffix}@example.de`;
  const notWhitelisted = `req-otp-none-${suffix}@example.de`;
  const ip = `203.0.113.${(Math.floor(Math.random() * 200) + 1).toString()}`;

  const allEmails = [whitelisted, lockedEmail, notWhitelisted];

  beforeAll(async () => {
    await db('email_whitelist').insert([
      { id: uuidv4(), email: whitelisted, created_by: 'test', created_at: new Date() },
      {
        id: uuidv4(),
        email: lockedEmail,
        created_by: 'test',
        created_at: new Date(),
        locked_at: new Date(),
        locked_by: 'test',
        locked_reason: 'test lock',
      },
    ]);
  });

  afterAll(async () => {
    // Clean OTP keys we may have created, then audit rows, then whitelist rows.
    await Promise.all(allEmails.map((e) => redis.del(`otp:${e.toLowerCase()}`)));
    try {
      await db('audit_logs').whereIn('user_email', allEmails).del();
    } finally {
      await db('email_whitelist').whereIn('email', allEmails).del();
    }
  });

  beforeEach(() => {
    sendOtpEmailMock.mockClear();
  });

  it('stores a sha-256-hashed OTP in Redis and mails a 6-digit code for a whitelisted email', async () => {
    await requestOtp(whitelisted, ip);

    // Mail was sent exactly once, to this email, with a 6-digit numeric code.
    expect(sendOtpEmailMock).toHaveBeenCalledTimes(1);
    const [toArg, codeArg] = sendOtpEmailMock.mock.calls[0];
    expect(toArg).toBe(whitelisted.toLowerCase());
    expect(typeof codeArg).toBe('string');
    expect(codeArg).toMatch(/^\d{6}$/);

    // Redis holds the OTP under otp:{email}, and the value is a SHA-256 hash
    // (64 hex chars), never the plaintext code.
    const stored = await redis.get(`otp:${whitelisted.toLowerCase()}`);
    expect(stored).not.toBeNull();
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toBe(codeArg);

    // The stored hash is exactly the hash of the mailed plaintext code.
    expect(stored).toBe(sha256Hex(codeArg as string));

    // A real TTL is set (single-use code expires), not a persistent key.
    const ttl = await redis.ttl(`otp:${whitelisted.toLowerCase()}`);
    expect(ttl).toBeGreaterThan(0);
  });

  it('writes an OTP_REQUEST audit entry for the whitelisted email', async () => {
    // Already requested in the prior test; assert the audit trail exists.
    const row = await db('audit_logs')
      .where({ user_email: whitelisted.toLowerCase(), operation: 'OTP_REQUEST' })
      .first();
    expect(row).toBeDefined();
    expect(row.resource_type).toBe('AUTH');
  });

  it('throws NOT_WHITELISTED with no mail and no Redis key for a non-whitelisted email', async () => {
    await expect(requestOtp(notWhitelisted, ip)).rejects.toThrow('NOT_WHITELISTED');

    expect(sendOtpEmailMock).not.toHaveBeenCalled();
    const stored = await redis.get(`otp:${notWhitelisted.toLowerCase()}`);
    expect(stored).toBeNull();
  });

  it('treats a locked whitelist entry like a non-whitelisted one (no mail, no key)', async () => {
    await expect(requestOtp(lockedEmail, ip)).rejects.toThrow('NOT_WHITELISTED');

    expect(sendOtpEmailMock).not.toHaveBeenCalled();
    const stored = await redis.get(`otp:${lockedEmail.toLowerCase()}`);
    expect(stored).toBeNull();
  });
});
