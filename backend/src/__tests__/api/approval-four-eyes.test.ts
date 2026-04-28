/**
 * approval-four-eyes.test.ts — End-to-end coverage for the 4-eyes workflow.
 * - First approval keeps PENDING
 * - Second approval from different site -> APPROVED
 * - Second approval from same site -> 409 ALREADY_APPROVED_SAME_SITE
 * - Same admin tries to approve twice -> 409 ALREADY_DECIDED
 * - Reject -> REJECTED immediately + signature recorded
 * - Silent-consent cron promotes after 7 days
 *
 * Dependencies: supertest, app, db, seed helpers, auth helper,
 *               approval-silent-consent.service, jest.mock(totp.service)
 */

// Mock TOTP verification so approve/reject routes accept any code in tests.
jest.mock('../../services/totp.service', () => ({
  ...jest.requireActual('../../services/totp.service'),
  verifyTotpCode: jest.fn().mockResolvedValue(true),
}));

import request from 'supertest';
import { app } from '../../app';
import { db } from '../../db/connection';
import { runSilentConsentSweep } from '../../services/approval-silent-consent.service';
import { cleanTestData, seedTestUser, seedOrganization, TEST_INSTANCE_ID } from '../helpers/seed';
import { getTestToken } from '../helpers/auth';
import { signGrant } from '../../lib/adminGrants';
import { v4 as uuidv4 } from 'uuid';

// ─── Admin identities ────────────────────────────────────────────────────────

const ADMIN_A_EMAIL = 'admin-a@imi-test.example.de';   // site: imi-test.example.de
const ADMIN_B_EMAIL = 'admin-b@imi-test.example.de';   // same site as A
const ADMIN_C_EMAIL = 'admin-c@charite-test.example.de'; // different site

const ADMIN_A_ID = '10000000-0000-0000-0000-000000000001';
const ADMIN_B_ID = '10000000-0000-0000-0000-000000000002';
const ADMIN_C_ID = '10000000-0000-0000-0000-000000000003';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seedAdminUsers(): Promise<void> {
  const admins = [
    { id: ADMIN_A_ID, email: ADMIN_A_EMAIL },
    { id: ADMIN_B_ID, email: ADMIN_B_EMAIL },
    { id: ADMIN_C_ID, email: ADMIN_C_EMAIL },
  ];
  for (const a of admins) {
    await db('email_whitelist')
      .insert({ id: uuidv4(), email: a.email, created_by: 'test', created_at: new Date() })
      .onConflict('email').ignore();
    // totp_enabled must be true so the route passes the TOTP_NOT_CONFIGURED guard.
    await db('users')
      .insert({ id: a.id, email: a.email, totp_enabled: true, totp_secret: 'placeholder', created_at: new Date() })
      .onConflict('email').ignore();
    const grantedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    const sig = signGrant(a.email, grantedAt, 'SYSTEM:test', 'SYSTEM:test');
    await db('admin_grants')
      .insert({ email: a.email, granted_at: grantedAt, granted_by_a: 'SYSTEM:test', granted_by_b: 'SYSTEM:test', signature_hex: sig })
      .onConflict('email').ignore();
  }
}

/** Submit a fresh PENDING approval request and return its id. */
async function submitPending(userToken: string): Promise<string> {
  const res = await request(app)
    .post(`/api/v1/instances/${TEST_INSTANCE_ID}/approval/submit`)
    .set('Authorization', `Bearer ${userToken}`);
  expect(res.status).toBe(200);
  return res.body.data.id as string;
}

// ─── Suite setup ─────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.APPROVAL_SILENT_CONSENT_DAYS = '7';
});

beforeEach(async () => {
  await cleanTestData();
  const { email } = await seedTestUser();
  await seedOrganization();
  await seedAdminUsers();
  // Store user token on the describe-level variable via closure (see each describe block).
  (beforeEach as any).__userEmail = email;
});

// ─── 4-eyes happy path ───────────────────────────────────────────────────────

describe('4-eyes approval workflow', () => {
  let userToken: string;
  let adminAToken: string;
  let adminBToken: string;
  let adminCToken: string;
  let rid: string;

  beforeEach(async () => {
    userToken = getTestToken((await db('users').where({ id: '00000000-0000-0000-0000-000000000001' }).first())?.email || 'test@test-hospital.de');
    adminAToken = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);
    adminBToken = getTestToken(ADMIN_B_EMAIL, ADMIN_B_ID);
    adminCToken = getTestToken(ADMIN_C_EMAIL, ADMIN_C_ID);
    // Re-fetch user email from DB to match seedTestUser constant.
    const user = await db('users').where({ id: '00000000-0000-0000-0000-000000000001' }).first();
    userToken = getTestToken(user.email, user.id);
    rid = await submitPending(userToken);
  });

  it('first approval (admin A) keeps the request PENDING', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/approval/${rid}/approve`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.reason).toBe('AWAITING_SECOND_OR_SILENT_CONSENT');

    const row = await db('approval_requests').where({ id: rid }).first();
    expect(row.status).toBe('PENDING');

    const sigs = await db('approval_signatures').where({ approval_request_id: rid });
    expect(sigs).toHaveLength(1);
    expect(sigs[0].admin_email).toBe(ADMIN_A_EMAIL);
    expect(sigs[0].decision).toBe('APPROVE');
  });

  it('second approval from different site (admin A then admin C) -> APPROVED', async () => {
    // First sign-off
    await request(app)
      .post(`/api/v1/admin/approval/${rid}/approve`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ totpCode: '000000' });

    // Second sign-off from a different site
    const res = await request(app)
      .post(`/api/v1/admin/approval/${rid}/approve`)
      .set('Authorization', `Bearer ${adminCToken}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');

    const row = await db('approval_requests').where({ id: rid }).first();
    expect(row.status).toBe('APPROVED');
    expect(row.resolved_by).toBe(ADMIN_C_EMAIL);

    const sigs = await db('approval_signatures').where({ approval_request_id: rid });
    expect(sigs).toHaveLength(2);
  });

  it('second approval from same site -> 409 ALREADY_APPROVED_SAME_SITE', async () => {
    // Admin A approves first
    await request(app)
      .post(`/api/v1/admin/approval/${rid}/approve`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ totpCode: '000000' });

    // Admin B is on the same site as A — must be rejected
    const res = await request(app)
      .post(`/api/v1/admin/approval/${rid}/approve`)
      .set('Authorization', `Bearer ${adminBToken}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_APPROVED_SAME_SITE');

    // Request must still be PENDING
    const row = await db('approval_requests').where({ id: rid }).first();
    expect(row.status).toBe('PENDING');
  });

  it('same admin tries to approve twice -> 409 ALREADY_DECIDED', async () => {
    // First approval
    await request(app)
      .post(`/api/v1/admin/approval/${rid}/approve`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ totpCode: '000000' });

    // Same admin tries again
    const res = await request(app)
      .post(`/api/v1/admin/approval/${rid}/approve`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_DECIDED');
  });

  it('reject by a single admin -> REJECTED immediately with signature recorded', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/approval/${rid}/reject`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ totpCode: '000000', comment: 'Incomplete data' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');

    const row = await db('approval_requests').where({ id: rid }).first();
    expect(row.status).toBe('REJECTED');
    expect(row.resolved_by).toBe(ADMIN_A_EMAIL);
    expect(row.comment).toBe('Incomplete data');

    const sigs = await db('approval_signatures').where({ approval_request_id: rid });
    expect(sigs).toHaveLength(1);
    expect(sigs[0].decision).toBe('REJECT');
    expect(sigs[0].admin_email).toBe(ADMIN_A_EMAIL);
  });
});

// ─── Silent-consent cron ─────────────────────────────────────────────────────

describe('silent-consent cron', () => {
  let userToken: string;
  let adminAToken: string;

  beforeEach(async () => {
    const user = await db('users').where({ id: '00000000-0000-0000-0000-000000000001' }).first();
    userToken = getTestToken(user.email, user.id);
    adminAToken = getTestToken(ADMIN_A_EMAIL, ADMIN_A_ID);
  });

  it('promotes a request with one APPROVE sig older than 7 days', async () => {
    const rid = await submitPending(userToken);

    // First sign-off from admin A
    await request(app)
      .post(`/api/v1/admin/approval/${rid}/approve`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ totpCode: '000000' });

    // Back-date the signature to 8 days ago
    const eightDaysAgo = new Date(Date.now() - 8 * 86400_000);
    await db('approval_signatures')
      .where({ approval_request_id: rid, admin_email: ADMIN_A_EMAIL })
      .update({ signed_at: eightDaysAgo });

    const promoted = await runSilentConsentSweep(new Date());

    expect(promoted).toBe(1);

    const row = await db('approval_requests').where({ id: rid }).first();
    expect(row.status).toBe('APPROVED');
    expect(row.resolved_by).toBe('SYSTEM:silent-consent');
  });

  it('does NOT promote a request whose only sig is less than 7 days old', async () => {
    const rid = await submitPending(userToken);

    // First sign-off from admin A (recent — default signed_at = now)
    await request(app)
      .post(`/api/v1/admin/approval/${rid}/approve`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ totpCode: '000000' });

    const promoted = await runSilentConsentSweep(new Date());

    expect(promoted).toBe(0);

    const row = await db('approval_requests').where({ id: rid }).first();
    expect(row.status).toBe('PENDING');
  });

  it('does NOT promote a request that was rejected', async () => {
    const rid = await submitPending(userToken);

    // Reject it
    await request(app)
      .post(`/api/v1/admin/approval/${rid}/reject`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ totpCode: '000000', comment: 'Nope' });

    const promoted = await runSilentConsentSweep(new Date());

    expect(promoted).toBe(0);

    const row = await db('approval_requests').where({ id: rid }).first();
    expect(row.status).toBe('REJECTED');
  });
});
