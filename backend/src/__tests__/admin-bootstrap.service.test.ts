/**
 * admin-bootstrap.service.test.ts – Verifies the idempotent early-return of
 * bootstrapAdminGrants(): when admin_grants already has at least one row, the
 * call must resolve without throwing AND must NOT change the row count (it
 * returns before touching IMI_ADMIN_EMAILS). The test seeds its own grant so
 * the precondition holds regardless of whether the DB was data-seeded.
 *
 * Dependencies: db/connection, admin-bootstrap.service, lib/adminGrants
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { signGrant } from '../lib/adminGrants';
import { bootstrapAdminGrants } from '../services/admin-bootstrap.service';

describe('admin-bootstrap.service – bootstrapAdminGrants idempotent no-op', () => {
  const seededEmail = `bootstrap-test-${Date.now()}@example.de`;

  async function grantCount(): Promise<number> {
    const row = await db('admin_grants').count('email as n').first();
    return Number((row as { n: number | string } | undefined)?.n ?? 0);
  }

  beforeAll(async () => {
    const grantedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    const sig = signGrant(seededEmail, grantedAt, 'SYSTEM:test', 'SYSTEM:test');
    await db('admin_grants').insert({
      email: seededEmail,
      granted_at: grantedAt,
      granted_by_a: 'SYSTEM:test',
      granted_by_b: 'SYSTEM:test',
      signature_hex: sig,
    }).onConflict('email').ignore();
  });

  afterAll(async () => {
    await db('admin_grants').where({ email: seededEmail }).del();
  });

  it('is a no-op when admin_grants already has rows (count unchanged, no throw)', async () => {
    const before = await grantCount();
    expect(before).toBeGreaterThan(0);

    await expect(bootstrapAdminGrants()).resolves.toBeUndefined();

    const after = await grantCount();
    expect(after).toBe(before);
  });
});
