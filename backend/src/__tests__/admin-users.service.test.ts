/**
 * admin-users.service.test.ts – Service-layer tests for the whitelist
 * lock/unlock state machine (no TOTP – that gating lives in the routes).
 * Exercises: listWhitelist (includes a seeded row), lockWhitelistEntry
 * (sets locked_at/locked_by/locked_reason) and unlockWhitelistEntry
 * (clears them). Also covers the CANNOT_LOCK_SELF and NOT_FOUND guards.
 * Dependencies: db/connection, admin-users.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import {
  listWhitelist,
  lockWhitelistEntry,
  unlockWhitelistEntry,
  AdminUsersError,
} from '../services/admin-users.service';

describe('admin-users.service – lock/unlock', () => {
  const target = `lock-target-${Date.now()}@example.de`;
  const actor = `lock-actor-${Date.now()}@imi.uni-muenster.de`;

  beforeAll(async () => {
    await db('email_whitelist').insert({
      id: uuidv4(),
      email: target,
      created_by: 'test',
      created_at: new Date(),
    });
  });

  afterAll(async () => {
    try {
      await db('audit_logs').whereIn('resource_id', [target]).del();
    } finally {
      await db('email_whitelist').where({ email: target }).del();
    }
  });

  it('listWhitelist includes the seeded row, initially unlocked and not admin', async () => {
    const rows = await listWhitelist();
    const row = rows.find((r) => r.email === target);
    expect(row).toBeDefined();
    expect(row!.locked_at).toBeNull();
    expect(row!.is_admin).toBe(false);
  });

  it('lockWhitelistEntry sets locked_at / locked_by / locked_reason', async () => {
    await lockWhitelistEntry(target, actor, 'security review');
    const dbRow = await db('email_whitelist').where({ email: target }).first();
    expect(dbRow.locked_at).not.toBeNull();
    expect(dbRow.locked_by).toBe(actor);
    expect(dbRow.locked_reason).toBe('security review');

    const listed = await listWhitelist();
    const row = listed.find((r) => r.email === target);
    expect(row!.locked_at).not.toBeNull();
  });

  it('unlockWhitelistEntry clears locked_at / locked_by / locked_reason', async () => {
    await unlockWhitelistEntry(target, actor);
    const dbRow = await db('email_whitelist').where({ email: target }).first();
    expect(dbRow.locked_at).toBeNull();
    expect(dbRow.locked_by).toBeNull();
    expect(dbRow.locked_reason).toBeNull();
  });

  it('rejects locking your own account (CANNOT_LOCK_SELF)', async () => {
    await expect(lockWhitelistEntry(target, target, 'x')).rejects.toThrow(AdminUsersError);
    await expect(lockWhitelistEntry(target, target, 'x')).rejects.toMatchObject({
      code: 'CANNOT_LOCK_SELF',
    });
  });

  it('rejects locking an email that is not in the whitelist (NOT_FOUND)', async () => {
    const missing = `missing-${uuidv4()}@example.de`;
    await expect(lockWhitelistEntry(missing, actor, 'x')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
