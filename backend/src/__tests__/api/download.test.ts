/**
 * download.test.ts — Integration tests for the download routes.
 * Covers GET /api/v1/instances/:id/download/bundle (signed FHIR bundle)
 * and GET /api/v1/download/ip-address-list (admin Excel export).
 *
 * Each suite seeds its OWN uniquely-named rows (concurrency-safe) and tears
 * them down in afterAll. No shared fixed-ID seed helpers are used.
 *
 * Dependencies: supertest, app, db/connection (Knex), auth helper, adminGrants
 */

import request from 'supertest';
import { app } from '../../app';
import { db } from '../../db/connection';
import { getTestToken } from '../helpers/auth';
import { signGrant } from '../../lib/adminGrants';
import { v4 as uuidv4 } from 'uuid';

interface BundleEntry {
  fullUrl: string;
  resource?: { resourceType: string; identifier?: Array<{ system: string; value: string }> };
}

describe('Download routes', () => {
  const sfx = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const userId = uuidv4();
  const email = `route-${sfx}@example.de`;
  const instanceId = uuidv4();
  const orgId = `route-${sfx}.example.de`;
  const endpointId = `dsf-fhir.${orgId}`;
  const parentOrgId = `verbund-${sfx}.example.de`;

  // Admin identity for the IP-address-list export (admin-only route).
  const adminId = uuidv4();
  const adminEmail = `admin-${sfx}@imi-test.example.de`;

  let token: string;
  let adminToken: string;

  beforeAll(async () => {
    // ── Non-admin owner + instance + org graph ──────────────────────────────
    await db('email_whitelist')
      .insert({ id: uuidv4(), email, created_by: 'test', created_at: new Date() })
      .onConflict('email')
      .ignore();
    await db('users')
      .insert({ id: userId, email, totp_enabled: false, created_at: new Date() })
      .onConflict('email')
      .ignore();
    await db('instances')
      .insert({ id: instanceId, user_id: userId, label: 'Download Test', created_at: new Date() })
      .onConflict('id')
      .ignore();
    await db('organizations')
      .insert({
        identifier: orgId,
        instance_id: instanceId,
        name: 'Download Test Org',
        active: true,
        email,
        address_line: 'Test Street 1',
        postal_code: '12345',
        city: 'Teststadt',
        country_code: 'DE',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict('identifier')
      .ignore();
    await db('endpoints')
      .insert({
        identifier: endpointId,
        organization_id: orgId,
        name: 'Test FHIR',
        address: `https://${endpointId}/fhir`,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict('identifier')
      .ignore();
    await db('endpoint_ips').insert({
      id: uuidv4(),
      endpoint_id: endpointId,
      ip: '10.0.0.42',
      is_fhir: true,
      is_bpe: false,
    });
    await db('certificates').insert({
      id: uuidv4(),
      organization_id: orgId,
      pem: 'PEM',
      subject: 'CN=download-test',
      thumbprint: 'b'.repeat(64),
      valid_until: '2099-01-01',
      created_at: new Date(),
    });
    await db('memberships').insert({
      id: uuidv4(),
      organization_id: orgId,
      parent_organization: parentOrgId,
      endpoint_id: endpointId,
      roles: JSON.stringify(['DIC']),
      created_at: new Date(),
      updated_at: new Date(),
    });
    // APPROVED so the org appears in the IP-address-list Excel export.
    await db('approval_requests').insert({
      id: uuidv4(),
      instance_id: instanceId,
      status: 'APPROVED',
      created_at: new Date(),
      submitted_at: new Date(),
      resolved_at: new Date(),
      resolved_by: adminEmail,
      snapshot_json: JSON.stringify({}),
    });

    // ── Admin identity (DB-backed signed grant) ─────────────────────────────
    await db('email_whitelist')
      .insert({ id: uuidv4(), email: adminEmail, created_by: 'test', created_at: new Date() })
      .onConflict('email')
      .ignore();
    await db('users')
      .insert({ id: adminId, email: adminEmail, totp_enabled: false, created_at: new Date() })
      .onConflict('email')
      .ignore();
    const grantedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    const sig = signGrant(adminEmail, grantedAt, 'SYSTEM:test', 'SYSTEM:test');
    await db('admin_grants')
      .insert({
        email: adminEmail,
        granted_at: grantedAt,
        granted_by_a: 'SYSTEM:test',
        granted_by_b: 'SYSTEM:test',
        signature_hex: sig,
      })
      .onConflict('email')
      .ignore();

    token = getTestToken(email, userId);
    adminToken = getTestToken(adminEmail, adminId);
  });

  afterAll(async () => {
    await db('admin_grants').where({ email: adminEmail }).del();
    await db('approval_requests').where({ instance_id: instanceId }).del();
    await db('memberships').where({ organization_id: orgId }).del();
    await db('certificates').where({ organization_id: orgId }).del();
    await db('endpoint_ips').where({ endpoint_id: endpointId }).del();
    await db('endpoints').where({ identifier: endpointId }).del();
    await db('organizations').where({ identifier: orgId }).del();
    await db('instances').where({ id: instanceId }).del();
    await db('users').whereIn('id', [userId, adminId]).del();
    await db('email_whitelist').whereIn('email', [email, adminEmail]).del();
  });

  describe('GET /api/v1/instances/:id/download/bundle', () => {
    it('returns 200 with a signed FHIR transaction Bundle for the seeded endpoint', async () => {
      const res = await request(app)
        .get(`/api/v1/instances/${instanceId}/download/bundle`)
        .query({ endpointId })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/fhir+json');
      expect(res.headers['x-bundle-signature']).toBeTruthy();
      expect(res.headers['x-content-hash']).toMatch(/^[0-9a-f]{64}$/);

      const bundle = JSON.parse(res.text) as {
        resourceType: string;
        type: string;
        entry: BundleEntry[];
      };
      expect(bundle.resourceType).toBe('Bundle');
      expect(bundle.type).toBe('transaction');

      // The seeded org + endpoint are present in the bundle.
      const orgValues = bundle.entry.flatMap((e) =>
        e.resource?.resourceType === 'Organization'
          ? (e.resource.identifier ?? []).map((i) => i.value)
          : [],
      );
      expect(orgValues).toContain(orgId);
      const epValues = bundle.entry.flatMap((e) =>
        e.resource?.resourceType === 'Endpoint'
          ? (e.resource.identifier ?? []).map((i) => i.value)
          : [],
      );
      expect(epValues).toContain(endpointId);
    });

    it('returns 401 without an Authorization header', async () => {
      const res = await request(app)
        .get(`/api/v1/instances/${instanceId}/download/bundle`)
        .query({ endpointId });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 when endpointId query param is missing', async () => {
      const res = await request(app)
        .get(`/api/v1/instances/${instanceId}/download/bundle`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_ENDPOINT');
    });

    it('returns 404 for an unknown endpointId', async () => {
      const res = await request(app)
        .get(`/api/v1/instances/${instanceId}/download/bundle`)
        .query({ endpointId: 'does-not-exist.example.de' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/v1/download/ip-address-list', () => {
    it('returns 200 with an xlsx content-type and a non-empty buffer for an admin', async () => {
      const res = await request(app)
        .get('/api/v1/download/ip-address-list')
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse((response, cb) => {
          const chunks: Buffer[] = [];
          response.on('data', (c: Buffer) => chunks.push(c));
          response.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toContain('.xlsx');
      // A real xlsx is a ZIP container — first two bytes are 'PK'.
      const body = res.body as Buffer;
      expect(body.length).toBeGreaterThan(0);
      expect(body.subarray(0, 2).toString('latin1')).toBe('PK');
    });

    it('returns 401 without an Authorization header', async () => {
      const res = await request(app).get('/api/v1/download/ip-address-list');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 for a non-admin user', async () => {
      const res = await request(app)
        .get('/api/v1/download/ip-address-list')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
