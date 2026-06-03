/**
 * organization-thumbprint-guard.test.ts – Verifies that an IMI admin acting on
 * a non-owned instance cannot change client_cert_thumbprint (the cert-login
 * credential) but can still edit other fields. Closes the auth-bypass attack
 * surfaced by the 2026-04-27 security review.
 *
 * Middleware notes:
 *   requireAuth is mocked to a passthrough so tests control req.user directly.
 *   requireInstanceOwnership runs against the real DB (reads instances.user_id).
 */
import express from 'express';
import request from 'supertest';
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

// Must be called before organizationRouter is imported so ts-jest hoists it.
jest.mock('../middleware/auth.middleware', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

// TOTP is required for owner-initiated thumbprint changes; mock it to a passthrough
// so the guard tests focus on the authorization logic, not on TOTP plumbing.
jest.mock('../services/totp.service', () => ({
  verifyTotpCode: jest.fn().mockResolvedValue(true),
}));

import { organizationRouter } from '../routes/organization.routes';
import { signGrant } from '../lib/adminGrants';

function appAs(userId: string, email: string) {
  const app = express();
  app.use(express.json());
  // Inject req.user before the router runs (requireAuth is a passthrough here).
  app.use((req, _res, next) => {
    (req as any).user = { id: userId, email };
    next();
  });
  app.use('/api/v1/instances/:id/organization', organizationRouter);
  return app;
}

describe('PUT /organization — admin cross-user thumbprint guard', () => {
  const ownerId = uuidv4();
  const adminId = uuidv4();
  const instanceId = uuidv4();
  const orgIdentifier = 'thumbprint-guard.example.de';
  const ORIG_THUMBPRINT = 'a'.repeat(64);
  const ATTACKER_THUMBPRINT = 'b'.repeat(64);
  const adminEmail = 'admin@imi-test.example.de';
  const ownerEmail = 'owner-tpg@example.de';

  const validBody = {
    identifier: orgIdentifier,
    name: 'Renamed By Admin',
    active: true,
    email: 'org@example.de',
  };

  beforeAll(async () => {
    // Clean up any leftover rows from prior runs or seed data that share these emails.
    await db('organizations').where({ identifier: orgIdentifier }).del();
    await db('instances').where({ id: instanceId }).del();
    await db('users').whereIn('email', [ownerEmail, adminEmail]).del();
    await db('admin_grants').where({ email: adminEmail }).del();

    await db('users').insert([
      { id: ownerId, email: ownerEmail, created_at: new Date() },
      { id: adminId, email: adminEmail, created_at: new Date() },
    ]);
    await db('instances').insert({
      id: instanceId,
      user_id: ownerId,
      label: 'L',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: orgIdentifier,
      instance_id: instanceId,
      name: 'Original Org',
      email: 'org@example.de',
      active: true,
      client_cert_thumbprint: ORIG_THUMBPRINT,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const grantedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    const sig = signGrant(adminEmail, grantedAt, 'SYSTEM:test', 'SYSTEM:test');
    await db('admin_grants').insert({
      email: adminEmail,
      granted_at: grantedAt,
      granted_by_a: 'SYSTEM:test',
      granted_by_b: 'SYSTEM:test',
      signature_hex: sig,
    });
  });

  afterAll(async () => {
    await db('admin_grants').where({ email: adminEmail }).del();
    await db('organizations').where({ identifier: orgIdentifier }).del();
    await db('instances').where({ id: instanceId }).del();
    await db('users').whereIn('email', [ownerEmail, adminEmail]).del();
  });

  // Reset thumbprint to ORIG_THUMBPRINT before each test to eliminate ordering dependency.
  beforeEach(async () => {
    await db('organizations')
      .where({ identifier: orgIdentifier })
      .update({ client_cert_thumbprint: ORIG_THUMBPRINT });
  });

  it('owner can change their own thumbprint', async () => {
    const res = await request(appAs(ownerId, ownerEmail))
      .put(`/api/v1/instances/${instanceId}/organization`)
      .send({ ...validBody, clientCertThumbprint: 'c'.repeat(64), totpCode: '123456' });
    expect(res.status).toBe(200);
  });

  it('admin can edit other fields on a non-owned org without changing the thumbprint', async () => {
    // Send the existing ORIG_THUMBPRINT — same value, guard must allow it.
    const res = await request(appAs(adminId, adminEmail))
      .put(`/api/v1/instances/${instanceId}/organization`)
      .send({ ...validBody, clientCertThumbprint: ORIG_THUMBPRINT });
    expect(res.status).toBe(200);
  });

  it('admin CANNOT change thumbprint on a non-owned org (403)', async () => {
    const res = await request(appAs(adminId, adminEmail))
      .put(`/api/v1/instances/${instanceId}/organization`)
      .send({ ...validBody, clientCertThumbprint: ATTACKER_THUMBPRINT });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_THUMBPRINT_WRITE');
  });
});
