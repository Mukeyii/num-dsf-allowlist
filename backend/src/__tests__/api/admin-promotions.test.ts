/**
 * admin-promotions.test.ts – Integration tests for /api/v1/admin/promotions
 * Covers: create request, guard validations, list, approve (same-admin, same-site, happy path),
 *         reject, cancel, and post-approval isAdminEmail verification.
 * Dependencies: supertest, app, db, seed helpers, auth helper, jest.mock(totp.service)
 */

// Mock TOTP so all write endpoints accept any 6-digit code in tests.
jest.mock('../../services/totp.service', () => ({
  ...jest.requireActual('../../services/totp.service'),
  verifyTotpCode: jest.fn().mockResolvedValue(true),
}));

import request from 'supertest';
import { app } from '../../app';
import { db } from '../../db/connection';
import { cleanTestData } from '../helpers/seed';
import { getTestToken } from '../helpers/auth';
import { signGrant } from '../../lib/adminGrants';
import { isAdminEmail } from '../../lib/isAdmin';
import { v4 as uuidv4 } from 'uuid';

// ─── Admin identities ────────────────────────────────────────────────────────

const ADMIN_A_EMAIL = 'admin-a@imi-test.example.de'; // site: imi-test.example.de
const ADMIN_B_EMAIL = 'admin-b@imi-test.example.de'; // same site as A
const ADMIN_C_EMAIL = 'admin-c@charite-test.example.de'; // different site

const ADMIN_A_ID = '10000000-0000-0000-0000-000000000001';
const ADMIN_B_ID = '10000000-0000-0000-0000-000000000002';
const ADMIN_C_ID = '10000000-0000-0000-0000-000000000003';

// Target user that will be promoted in various tests
const TARGET_EMAIL = 'target@new-hospital.de';
const TARGET_ID = '20000000-0000-0000-0000-000000000001';

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

async function seedWhitelistedUser(id: string, email: string): Promise<void> {
  await db('email_whitelist')
    .insert({ id: uuidv4(), email, created_by: 'test', created_at: new Date() })
    .onConflict('email')
    .ignore();
  await db('users')
    .insert({ id, email, totp_enabled: false, created_at: new Date() })
    .onConflict('email')
    .ignore();
}

/** Creates a promotion request as admin A and returns the request id. */
async function createRequest(targetEmail: string = TARGET_EMAIL): Promise<string> {
  const token = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);
  const res = await request(app)
    .post('/api/v1/admin/promotions')
    .set('Authorization', `Bearer ${token}`)
    .send({ targetEmail, totpCode: '000000' });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

// ─── Suite setup ─────────────────────────────────────────────────────────────

beforeEach(async () => {
  await cleanTestData();
  await seedAdminUser(ADMIN_A_ID, ADMIN_A_EMAIL);
  await seedAdminUser(ADMIN_B_ID, ADMIN_B_EMAIL);
  await seedAdminUser(ADMIN_C_ID, ADMIN_C_EMAIL);
  await seedWhitelistedUser(TARGET_ID, TARGET_EMAIL);
});

// ─── Create request ───────────────────────────────────────────────────────────

describe('POST /api/v1/admin/promotions (create request)', () => {
  it('creates a PENDING request and returns { id } (201)', async () => {
    const token = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    const res = await request(app)
      .post('/api/v1/admin/promotions')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetEmail: TARGET_EMAIL, totpCode: '000000' });

    expect(res.status).toBe(201);
    expect(typeof res.body.data.id).toBe('string');

    const row = await db('admin_promotion_requests').where({ id: res.body.data.id }).first();
    expect(row.status).toBe('PENDING');
    expect(row.target_email).toBe(TARGET_EMAIL);
  });

  it('returns 400 if target is not whitelisted', async () => {
    const token = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    const res = await request(app)
      .post('/api/v1/admin/promotions')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetEmail: 'notexist@unknown.de', totpCode: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOT_WHITELISTED');
  });

  it('returns 400 if target is locked', async () => {
    // Lock the target first
    await db('email_whitelist')
      .where({ email: TARGET_EMAIL })
      .update({ locked_at: new Date(), locked_by: ADMIN_A_EMAIL, locked_reason: 'test' });

    const token = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    const res = await request(app)
      .post('/api/v1/admin/promotions')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetEmail: TARGET_EMAIL, totpCode: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TARGET_LOCKED');
  });

  it('returns 409 if target is already an admin', async () => {
    const token = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    const res = await request(app)
      .post('/api/v1/admin/promotions')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetEmail: ADMIN_B_EMAIL, totpCode: '000000' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_ADMIN');
  });

  it('returns 409 if a PENDING request already exists for target', async () => {
    const token = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    // First request
    await request(app)
      .post('/api/v1/admin/promotions')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetEmail: TARGET_EMAIL, totpCode: '000000' });

    // Duplicate
    const res = await request(app)
      .post('/api/v1/admin/promotions')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetEmail: TARGET_EMAIL, totpCode: '000000' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_PENDING');
  });
});

// ─── List ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/admin/promotions', () => {
  it('lists PENDING promotion requests', async () => {
    const id = await createRequest();
    const token = getTestToken(ADMIN_C_EMAIL, ADMIN_C_ID);

    const res = await request(app)
      .get('/api/v1/admin/promotions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((r: any) => r.id);
    expect(ids).toContain(id);
  });
});

// ─── Approve ─────────────────────────────────────────────────────────────────

describe('POST /api/v1/admin/promotions/:id/approve', () => {
  it('same requester cannot approve own request → 403 SELF_APPROVE', async () => {
    const id = await createRequest(); // requested by admin-a
    const tokenA = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    const res = await request(app)
      .post(`/api/v1/admin/promotions/${id}/approve`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SELF_APPROVE');
  });

  it('same-site admin cannot approve → 403 SAME_SITE', async () => {
    const id = await createRequest(); // requested by admin-a (imi-test)
    const tokenB = getTestToken(ADMIN_B_EMAIL, ADMIN_B_ID); // also imi-test

    const res = await request(app)
      .post(`/api/v1/admin/promotions/${id}/approve`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SAME_SITE');
  });

  it('different-site admin approves → status APPROVED, admin_grants row created', async () => {
    const id = await createRequest(); // requested by admin-a (imi-test)
    const tokenC = getTestToken(ADMIN_C_EMAIL, ADMIN_C_ID); // charite — different site

    const res = await request(app)
      .post(`/api/v1/admin/promotions/${id}/approve`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(200);

    const req = await db('admin_promotion_requests').where({ id }).first();
    expect(req.status).toBe('APPROVED');
    expect(req.approver_b).toBe(ADMIN_C_EMAIL);

    const grant = await db('admin_grants').where({ email: TARGET_EMAIL }).first();
    expect(grant).toBeTruthy();
    expect(typeof grant.signature_hex).toBe('string');
    expect(grant.signature_hex.length).toBeGreaterThan(0);
  });

  it('after approval, isAdminEmail() returns true for the target (signature verifies)', async () => {
    const id = await createRequest();
    const tokenC = getTestToken(ADMIN_C_EMAIL, ADMIN_C_ID);

    await request(app)
      .post(`/api/v1/admin/promotions/${id}/approve`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ totpCode: '000000' });

    expect(await isAdminEmail(TARGET_EMAIL)).toBe(true);
  });
});

// ─── Reject ───────────────────────────────────────────────────────────────────

describe('POST /api/v1/admin/promotions/:id/reject', () => {
  it('reject without reason → 400', async () => {
    const id = await createRequest();
    const tokenC = getTestToken(ADMIN_C_EMAIL, ADMIN_C_ID);

    const res = await request(app)
      .post(`/api/v1/admin/promotions/${id}/reject`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ totpCode: '000000', reason: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REASON_REQUIRED');
  });

  it('reject with reason → status REJECTED, no admin_grants row created', async () => {
    const id = await createRequest();
    const tokenC = getTestToken(ADMIN_C_EMAIL, ADMIN_C_ID);

    const res = await request(app)
      .post(`/api/v1/admin/promotions/${id}/reject`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ totpCode: '000000', reason: 'Incomplete documentation' });

    expect(res.status).toBe(200);

    const req = await db('admin_promotion_requests').where({ id }).first();
    expect(req.status).toBe('REJECTED');
    expect(req.rejection_reason).toBe('Incomplete documentation');

    const grant = await db('admin_grants').where({ email: TARGET_EMAIL }).first();
    expect(grant).toBeUndefined();
  });
});

// ─── Cancel ───────────────────────────────────────────────────────────────────

describe('POST /api/v1/admin/promotions/:id/cancel', () => {
  it('requester can cancel own request → status CANCELLED', async () => {
    const id = await createRequest(); // created by admin-a
    const tokenA = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);

    const res = await request(app)
      .post(`/api/v1/admin/promotions/${id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(200);
    const req = await db('admin_promotion_requests').where({ id }).first();
    expect(req.status).toBe('CANCELLED');
  });

  it('non-requester cancel → 400 NOT_REQUESTER', async () => {
    const id = await createRequest(); // created by admin-a
    const tokenC = getTestToken(ADMIN_C_EMAIL, ADMIN_C_ID); // different admin

    const res = await request(app)
      .post(`/api/v1/admin/promotions/${id}/cancel`)
      .set('Authorization', `Bearer ${tokenC}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOT_REQUESTER');

    // Request must still be PENDING
    const req = await db('admin_promotion_requests').where({ id }).first();
    expect(req.status).toBe('PENDING');
  });
});
