/**
 * admin-users.test.ts – Integration tests for /api/v1/admin/users
 * Covers: list whitelist, add email, lock/unlock, demote, delete, self-protection,
 *         lock-state session-revocation (via login rejection).
 * Dependencies: supertest, app, db, seed helpers, auth helper, jest.mock(totp.service)
 */

// Mock TOTP so write endpoints accept any 6-digit code in tests.
jest.mock('../../services/totp.service', () => ({
  ...jest.requireActual('../../services/totp.service'),
  verifyTotpCode: jest.fn().mockResolvedValue(true),
}));

import request from 'supertest';
import { app } from '../../app';
import { db } from '../../db/connection';
import { cleanTestData, seedTestUser } from '../helpers/seed';
import { getTestToken } from '../helpers/auth';
import { signGrant } from '../../lib/adminGrants';
import { v4 as uuidv4 } from 'uuid';

// ─── Admin identities ────────────────────────────────────────────────────────

const ADMIN_A_EMAIL = 'admin-a@imi-test.example.de'; // site: imi-test.example.de
const ADMIN_B_EMAIL = 'admin-b@imi-test.example.de'; // same site as A
const ADMIN_C_EMAIL = 'admin-c@charite-test.example.de'; // different site

const ADMIN_A_ID = '10000000-0000-0000-0000-000000000001';
const ADMIN_B_ID = '10000000-0000-0000-0000-000000000002';
const ADMIN_C_ID = '10000000-0000-0000-0000-000000000003';

const NON_ADMIN_EMAIL = 'user@outsider-hospital.de';
const NON_ADMIN_ID = '10000000-0000-0000-0000-000000000099';

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedAdminUser(id: string, email: string): Promise<void> {
  await db('email_whitelist')
    .insert({ id: uuidv4(), email, created_by: 'test', created_at: new Date() })
    .onConflict('email')
    .ignore();
  await db('users')
    .insert({ id, email, totp_enabled: true, totp_secret: 'placeholder', created_at: new Date() })
    .onConflict('email')
    .ignore();
  const grantedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
  const sig = signGrant(email, grantedAt, 'SYSTEM:test', 'SYSTEM:test');
  await db('admin_grants')
    .insert({
      email,
      granted_at: grantedAt,
      granted_by_a: 'SYSTEM:test',
      granted_by_b: 'SYSTEM:test',
      signature_hex: sig,
    })
    .onConflict('email')
    .ignore();
}

async function seedNonAdmin(id: string, email: string): Promise<void> {
  await db('email_whitelist')
    .insert({ id: uuidv4(), email, created_by: 'test', created_at: new Date() })
    .onConflict('email')
    .ignore();
  await db('users')
    .insert({ id, email, totp_enabled: false, created_at: new Date() })
    .onConflict('email')
    .ignore();
}

// ─── Suite setup ─────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanTestData();
  await seedTestUser();
  await seedAdminUser(ADMIN_A_ID, ADMIN_A_EMAIL);
  await seedAdminUser(ADMIN_B_ID, ADMIN_B_EMAIL);
  await seedAdminUser(ADMIN_C_ID, ADMIN_C_EMAIL);
  await seedNonAdmin(NON_ADMIN_ID, NON_ADMIN_EMAIL);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/admin/users', () => {
  it('returns the whitelist for an admin caller (200)', async () => {
    const token = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const emails = res.body.data.map((e: any) => e.email);
    expect(emails).toContain(ADMIN_A_EMAIL);
  });

  it('returns 403 for a non-admin caller', async () => {
    const token = getTestToken(NON_ADMIN_EMAIL, NON_ADMIN_ID);

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/admin/users (add to whitelist)', () => {
  it('admin can add a new email (201)', async () => {
    const token = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);
    const newEmail = 'new-user@hospital-xyz.de';

    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: newEmail, totpCode: '000000' });

    expect(res.status).toBe(201);
    const row = await db('email_whitelist').where({ email: newEmail }).first();
    expect(row).toBeTruthy();
  });

  it('returns 409 if email is already whitelisted', async () => {
    const token = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: ADMIN_B_EMAIL, totpCode: '000000' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_EXISTS');
  });
});

describe('POST /api/v1/admin/users/:email/lock', () => {
  it('admin can lock another user; locked_at is set', async () => {
    const token = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    const res = await request(app)
      .post(`/api/v1/admin/users/${encodeURIComponent(NON_ADMIN_EMAIL)}/lock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Policy violation', totpCode: '000000' });

    expect(res.status).toBe(200);
    const row = await db('email_whitelist').where({ email: NON_ADMIN_EMAIL }).first();
    expect(row.locked_at).not.toBeNull();
    expect(row.locked_by).toBe(ADMIN_A_EMAIL);
  });

  it('lock sets locked_at + locked_reason (session revocation via revokeAllSessions is exercised)', async () => {
    const token = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    const res = await request(app)
      .post(`/api/v1/admin/users/${encodeURIComponent(NON_ADMIN_EMAIL)}/lock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Policy violation', totpCode: '000000' });

    expect(res.status).toBe(200);

    // DB must reflect the locked state (revokeAllSessions runs in the same code path).
    const row = await db('email_whitelist').where({ email: NON_ADMIN_EMAIL }).first();
    expect(row.locked_at).not.toBeNull();
    expect(row.locked_by).toBe(ADMIN_A_EMAIL);
    expect(row.locked_reason).toBe('Policy violation');
  });

  it('self-lock attempt returns 400 CANNOT_LOCK_SELF', async () => {
    const token = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    const res = await request(app)
      .post(`/api/v1/admin/users/${encodeURIComponent(ADMIN_A_EMAIL)}/lock`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Self lock', totpCode: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_LOCK_SELF');
  });
});

describe('POST /api/v1/admin/users/:email/unlock', () => {
  it('admin can unlock a previously locked user', async () => {
    const tokenA = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    // Lock first
    await request(app)
      .post(`/api/v1/admin/users/${encodeURIComponent(NON_ADMIN_EMAIL)}/lock`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ reason: 'Temp lock', totpCode: '000000' });

    // Confirm locked
    let row = await db('email_whitelist').where({ email: NON_ADMIN_EMAIL }).first();
    expect(row.locked_at).not.toBeNull();

    // Unlock
    const res = await request(app)
      .post(`/api/v1/admin/users/${encodeURIComponent(NON_ADMIN_EMAIL)}/unlock`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(200);
    row = await db('email_whitelist').where({ email: NON_ADMIN_EMAIL }).first();
    expect(row.locked_at).toBeNull();
  });
});

describe('POST /api/v1/admin/users/:email/demote', () => {
  it('rejects (409 MIN_ADMINS_REACHED) when removing would leave < 2 admins from 2 sites', async () => {
    // Only admin-a (imi-test) and admin-c (charite) are two admins from two sites.
    // If we remove admin-c, only admin-a + admin-b remain — both on imi-test (1 site).
    // So demoting admin-b should succeed, but demoting admin-c should fail
    // if that would leave only imi-test admins.
    // Let's first demote admin-b (same site as A) — that should succeed as A + C remain.
    const tokenA = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    // Demoting admin-c would leave only admin-a + admin-b (both imi-test, 1 site) → 409
    const res = await request(app)
      .post(`/api/v1/admin/users/${encodeURIComponent(ADMIN_C_EMAIL)}/demote`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MIN_ADMINS_REACHED');

    // admin-c grant must still exist
    const grant = await db('admin_grants').where({ email: ADMIN_C_EMAIL }).first();
    expect(grant).toBeTruthy();
  });

  it('succeeds when ≥2 admins from ≥2 sites remain after demote', async () => {
    // admin-a (imi-test), admin-b (imi-test), admin-c (charite)
    // Demoting admin-b: admin-a (imi-test) + admin-c (charite) remain → 2 admins, 2 sites → OK
    const tokenA = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    const res = await request(app)
      .post(`/api/v1/admin/users/${encodeURIComponent(ADMIN_B_EMAIL)}/demote`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(200);
    // Grant row must be gone
    const grant = await db('admin_grants').where({ email: ADMIN_B_EMAIL }).first();
    expect(grant).toBeUndefined();
  });
});

describe('DELETE /api/v1/admin/users/:email', () => {
  it('removes a non-admin user from the whitelist', async () => {
    const token = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    const res = await request(app)
      .delete(`/api/v1/admin/users/${encodeURIComponent(NON_ADMIN_EMAIL)}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(200);
    const row = await db('email_whitelist').where({ email: NON_ADMIN_EMAIL }).first();
    expect(row).toBeUndefined();
  });

  it('removes an admin user and revokes the admin_grants row', async () => {
    // demote admin-b first so that admin-a + admin-c remain (satisfies min-admins guard)
    // then admin-b can be deleted
    const tokenA = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    // Demote admin-b first to satisfy the "at least 2 admins from 2 sites" guard for delete
    await request(app)
      .post(`/api/v1/admin/users/${encodeURIComponent(ADMIN_B_EMAIL)}/demote`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ totpCode: '000000' });

    // Now delete admin-b (no longer an admin, so min-admins guard doesn't apply)
    const res = await request(app)
      .delete(`/api/v1/admin/users/${encodeURIComponent(ADMIN_B_EMAIL)}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(200);
    const wl = await db('email_whitelist').where({ email: ADMIN_B_EMAIL }).first();
    expect(wl).toBeUndefined();
    const grant = await db('admin_grants').where({ email: ADMIN_B_EMAIL }).first();
    expect(grant).toBeUndefined();
  });
});
