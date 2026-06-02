/**
 * admin-bootstrap.service.test.ts – Verifies the idempotent early-return of
 * bootstrapAdminGrants(): when admin_grants already has rows (the dev/CI DB is
 * seeded), the call must resolve without throwing AND must NOT change the
 * existing row count (it returns before touching IMI_ADMIN_EMAILS).
 *
 * Dependencies: db/connection, admin-bootstrap.service
 */
import { db } from '../db/connection';
import { bootstrapAdminGrants } from '../services/admin-bootstrap.service';

describe('admin-bootstrap.service – bootstrapAdminGrants idempotent no-op', () => {
  async function grantCount(): Promise<number> {
    const row = await db('admin_grants').count('email as n').first();
    return Number((row as { n: number | string } | undefined)?.n ?? 0);
  }

  it('is a no-op when admin_grants already has rows (count unchanged, no throw)', async () => {
    const before = await grantCount();
    // Precondition for this assertion to be meaningful: the seeded DB has grants.
    expect(before).toBeGreaterThan(0);

    await expect(bootstrapAdminGrants()).resolves.toBeUndefined();

    const after = await grantCount();
    expect(after).toBe(before);
  });
});
