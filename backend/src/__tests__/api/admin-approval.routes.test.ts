/**
 * admin-approval.routes.test.ts — Route-level coverage for /api/v1/admin/approval.
 * Covers:
 *   - GET  /pending          lists a PENDING approval request (with signatures)
 *   - POST /:rid/approve     second cross-site sign-off resolves it → APPROVED
 *   - POST /:rid/reject      reject with a comment resolves it → REJECTED
 *   - non-admin (whitelisted, no admin_grant) → 403 FORBIDDEN
 *   - no Authorization header → 401
 *
 * House pattern: real test DB via db/connection; UNIQUE rows per run
 * (uuidv4 + unique emails/identifiers); supertest the imported app with
 * getTestToken for auth; own rows torn down in afterAll. Mail path
 * (approval-reminder.service) is mocked so no SMTP is attempted; TOTP is
 * mocked so any code passes the verifier.
 *
 * Dependencies: supertest, app, db, getTestToken, signGrant,
 *               jest.mock(totp.service), jest.mock(approval-reminder.service)
 */

// Accept any 6-digit TOTP code in tests.
jest.mock('../../services/totp.service', () => ({
  ...jest.requireActual('../../services/totp.service'),
  verifyTotpCode: jest.fn().mockResolvedValue(true),
}));

// Stub the email path: approve/reject fire these notifications fire-and-forget.
// Mocking them keeps the test off SMTP entirely.
jest.mock('../../services/approval-reminder.service', () => ({
  notifyImiOnSubmit: jest.fn().mockResolvedValue(undefined),
  notifySiteOnApproval: jest.fn().mockResolvedValue(undefined),
  notifyImiOnFirstApproval: jest.fn().mockResolvedValue(undefined),
  runApprovalReminders: jest.fn().mockResolvedValue(undefined),
}));

import request from 'supertest';
import { app } from '../../app';
import { db } from '../../db/connection';
import { getTestToken } from '../helpers/auth';
import { signGrant } from '../../lib/adminGrants';
import { v4 as uuidv4 } from 'uuid';

// ─── Unique identities (suffix isolates this suite's rows) ────────────────────

const SUFFIX = uuidv4().slice(0, 8);
// Admin who performs the route action — site: site-x-<suffix>.example.de
const ADMIN_EMAIL = `aa-admin-${SUFFIX}@site-x-${SUFFIX}.example.de`;
const ADMIN_ID = uuidv4();
// A whitelisted, NON-admin user (no admin_grant row) — for the 403 case.
const NON_ADMIN_EMAIL = `aa-user-${SUFFIX}@hospital-${SUFFIX}.example.de`;
const NON_ADMIN_ID = uuidv4();
// A different-site admin email whose APPROVE signature we pre-seed so the
// route's own approve crosses the 2-distinct-site threshold → APPROVED.
const PRESIGNED_ADMIN_EMAIL = `aa-pre-${SUFFIX}@site-y-${SUFFIX}.example.de`;
const PRESIGNED_SITE = `site-y-${SUFFIX}.example.de`;

const INSTANCE_ID = uuidv4();

// Track inserted ids so afterAll only deletes this suite's rows.
const createdRequestIds: string[] = [];

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedAdmin(id: string, email: string): Promise<void> {
  await db('email_whitelist').insert({
    id: uuidv4(),
    email,
    created_by: 'test',
    created_at: new Date(),
  });
  await db('users').insert({
    id,
    email,
    totp_enabled: true,
    totp_secret: 'placeholder',
    created_at: new Date(),
  });
  const grantedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
  const sig = signGrant(email, grantedAt, 'SYSTEM:test', 'SYSTEM:test');
  await db('admin_grants').insert({
    email,
    granted_at: grantedAt,
    granted_by_a: 'SYSTEM:test',
    granted_by_b: 'SYSTEM:test',
    signature_hex: sig,
  });
}

/** Whitelisted, non-admin user (no admin_grant) — owns the instance below. */
async function seedNonAdmin(): Promise<void> {
  await db('email_whitelist').insert({
    id: uuidv4(),
    email: NON_ADMIN_EMAIL,
    created_by: 'test',
    created_at: new Date(),
  });
  await db('users').insert({
    id: NON_ADMIN_ID,
    email: NON_ADMIN_EMAIL,
    totp_enabled: true,
    totp_secret: 'placeholder',
    created_at: new Date(),
  });
}

async function seedInstance(): Promise<void> {
  await db('instances').insert({
    id: INSTANCE_ID,
    user_id: NON_ADMIN_ID,
    label: `inst-${SUFFIX}`,
    created_at: new Date(),
  });
}

/** Insert a fresh PENDING approval_request and return its id. */
async function seedPendingRequest(): Promise<string> {
  const id = uuidv4();
  const now = new Date();
  await db('approval_requests').insert({
    id,
    instance_id: INSTANCE_ID,
    status: 'PENDING',
    created_at: now,
    submitted_at: now,
    snapshot_json: JSON.stringify({ organization: { identifier: `org-${SUFFIX}` } }),
  });
  createdRequestIds.push(id);
  return id;
}

/** Pre-seed one APPROVE signature from a different site than ADMIN_EMAIL. */
async function seedForeignApproveSig(requestId: string): Promise<void> {
  await db('approval_signatures').insert({
    id: uuidv4(),
    approval_request_id: requestId,
    admin_email: PRESIGNED_ADMIN_EMAIL,
    admin_site: PRESIGNED_SITE,
    decision: 'APPROVE',
    signed_at: new Date(),
    comment: null,
  });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await seedNonAdmin();
  await seedInstance();
  await seedAdmin(ADMIN_ID, ADMIN_EMAIL);
});

afterAll(async () => {
  // Children first (FK), then parents. Only this suite's rows.
  if (createdRequestIds.length > 0) {
    await db('approval_signatures').whereIn('approval_request_id', createdRequestIds).del();
    await db('approval_requests').whereIn('id', createdRequestIds).del();
  }
  await db('instances').where({ id: INSTANCE_ID }).del();
  await db('admin_grants').whereIn('email', [ADMIN_EMAIL, PRESIGNED_ADMIN_EMAIL]).del();
  await db('users').whereIn('id', [ADMIN_ID, NON_ADMIN_ID]).del();
  await db('email_whitelist').whereIn('email', [ADMIN_EMAIL, NON_ADMIN_EMAIL]).del();
  await db.destroy();
});

// ─── GET /pending ─────────────────────────────────────────────────────────────

describe('GET /api/v1/admin/approval/pending', () => {
  it('lists a PENDING request with its signatures (200)', async () => {
    const rid = await seedPendingRequest();
    await seedForeignApproveSig(rid);
    const token = getTestToken(ADMIN_EMAIL, ADMIN_ID);

    const res = await request(app)
      .get('/api/v1/admin/approval/pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const found = res.body.data.find((r: { id: string }) => r.id === rid);
    expect(found).toBeTruthy();
    expect(found.status).toBe('PENDING');
    expect(Array.isArray(found.signatures)).toBe(true);
    expect(found.signatures).toHaveLength(1);
    expect(found.signatures[0].admin_email).toBe(PRESIGNED_ADMIN_EMAIL);
  });

  it('returns 403 for a whitelisted non-admin user', async () => {
    const token = getTestToken(NON_ADMIN_EMAIL, NON_ADMIN_ID);

    const res = await request(app)
      .get('/api/v1/admin/approval/pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/v1/admin/approval/pending');
    expect(res.status).toBe(401);
  });
});

// ─── POST /:rid/approve ───────────────────────────────────────────────────────

describe('POST /api/v1/admin/approval/:rid/approve', () => {
  it('second cross-site sign-off resolves the request → APPROVED', async () => {
    const rid = await seedPendingRequest();
    // One APPROVE already exists from a different site; the route admin's
    // sign-off is the 2nd distinct site → deriveStatus promotes to APPROVED.
    await seedForeignApproveSig(rid);
    const token = getTestToken(ADMIN_EMAIL, ADMIN_ID);

    const res = await request(app)
      .post(`/api/v1/admin/approval/${rid}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ totpCode: '000000' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');

    const row = await db('approval_requests').where({ id: rid }).first();
    expect(row.status).toBe('APPROVED');
    expect(row.resolved_by).toBe(ADMIN_EMAIL);

    const sigs = await db('approval_signatures').where({ approval_request_id: rid });
    expect(sigs).toHaveLength(2);
  });

  it('returns 400 TOTP_REQUIRED when no totpCode is supplied', async () => {
    const rid = await seedPendingRequest();
    const token = getTestToken(ADMIN_EMAIL, ADMIN_ID);

    const res = await request(app)
      .post(`/api/v1/admin/approval/${rid}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOTP_REQUIRED');
  });
});

// ─── POST /:rid/reject ────────────────────────────────────────────────────────

describe('POST /api/v1/admin/approval/:rid/reject', () => {
  it('reject with a comment resolves the request → REJECTED', async () => {
    const rid = await seedPendingRequest();
    const token = getTestToken(ADMIN_EMAIL, ADMIN_ID);

    const res = await request(app)
      .post(`/api/v1/admin/approval/${rid}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ totpCode: '000000', comment: 'Incomplete documentation' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');

    const row = await db('approval_requests').where({ id: rid }).first();
    expect(row.status).toBe('REJECTED');
    expect(row.resolved_by).toBe(ADMIN_EMAIL);
    expect(row.comment).toBe('Incomplete documentation');

    const sigs = await db('approval_signatures').where({ approval_request_id: rid });
    expect(sigs).toHaveLength(1);
    expect(sigs[0].decision).toBe('REJECT');
  });

  it('returns 403 for a non-admin user', async () => {
    const rid = await seedPendingRequest();
    const token = getTestToken(NON_ADMIN_EMAIL, NON_ADMIN_ID);

    const res = await request(app)
      .post(`/api/v1/admin/approval/${rid}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ totpCode: '000000', comment: 'nope' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    // Request must stay PENDING — the guard ran before any service call.
    const row = await db('approval_requests').where({ id: rid }).first();
    expect(row.status).toBe('PENDING');
  });
});
