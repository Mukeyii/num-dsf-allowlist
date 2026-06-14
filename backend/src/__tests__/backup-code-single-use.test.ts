/**
 * backup-code-single-use.test.ts — security regression: a backup code must
 * authenticate exactly once. After verifyBackupCode consumes it the same code
 * must fail, and a wrong code must never pass. Uses the real bcrypt (rounds 12)
 * to seed the stored hash, matching generateBackupCodes. DB-backed.
 *
 * Dependencies: db/connection, totp.service, bcrypt
 */
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { db } from '../db/connection';
import { verifyBackupCode } from '../services/totp.service';

describe('backup code single-use', () => {
  const userId = uuidv4();
  const email = `backup-su-${Date.now()}@example.de`;
  const code = 'ABCD1234';

  beforeAll(async () => {
    const hashed = await bcrypt.hash(code, 12);
    await db('users').insert({
      id: userId,
      email,
      totp_enabled: true,
      backup_codes: JSON.stringify([hashed]),
      created_at: new Date(),
    });
  });

  afterAll(async () => {
    await db('users').where({ id: userId }).del();
  });

  // Runs first, while the valid hash is still present, so the bcrypt loop
  // actually scans a real hash and finds no match (not just an empty array).
  it('rejects a wrong backup code', async () => {
    expect(await verifyBackupCode(userId, 'WRONGCODE')).toBe(false);
  });

  it('accepts the backup code once then rejects it on reuse', async () => {
    expect(await verifyBackupCode(userId, code)).toBe(true);
    // The code was consumed on the first success — a replay must fail.
    expect(await verifyBackupCode(userId, code)).toBe(false);
  });
});
