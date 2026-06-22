// Purpose: Integration tests for the network map route (GET /api/v1/network/map)
// Dependencies: supertest, app, db/connection, auth helper, adminGrants, uuid
//
// Exercises the HTTP layer of network.routes.ts: that an authenticated request
// gets the federation projection ({ data: { organizations }, meta: { isAdmin } }),
// that the admin token sees the detailed endpoint projection while a non-admin
// token sees the redacted one, and that a tokenless request is rejected with 401.
//
// Self-contained unique fixtures (no shared fixed-ID seed helpers) so the suite
// is concurrency-safe under parallel jest and cleans up its own rows. The route
// sends no mail, so no mail service mock is required.

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { app } from '../../app';
import { db } from '../../db/connection';
import { getTestToken } from '../helpers/auth';
import { signGrant } from '../../lib/adminGrants';

type OrgProjection = {
  identifier: string;
  endpoints: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

describe('Network API – GET /api/v1/network/map', () => {
  const sfx = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  // Owner of the seeded instance graph; a freshly seeded user is NOT an admin.
  const userId = uuidv4();
  const email = `net-route-${sfx}@example.de`;

  // A separate identity carrying a cryptographically verified admin grant, used
  // to drive the admin projection branch through the real isAdmin lookup.
  const adminUserId = uuidv4();
  const adminEmail = `net-admin-${sfx}@example.de`;

  const instanceId = uuidv4();
  const orgId = `net-route-${sfx}.example.de`;
  const endpointId = `ep-net-route-${sfx}.example.de`;
  const endpointAddress = `https://${endpointId}/fhir`;
  const endpointIp = '10.99.0.1';
  const membershipId = uuidv4();
  const approvalId = uuidv4();

  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await db('email_whitelist')
      .insert([
        { id: uuidv4(), email, created_by: 'test', created_at: new Date() },
        { id: uuidv4(), email: adminEmail, created_by: 'test', created_at: new Date() },
      ])
      .onConflict('email')
      .ignore();
    await db('users')
      .insert([
        { id: userId, email, totp_enabled: false, created_at: new Date() },
        { id: adminUserId, email: adminEmail, totp_enabled: false, created_at: new Date() },
      ])
      .onConflict('email')
      .ignore();

    // Sign a verified admin grant for the admin identity. granted_at is truncated
    // to whole seconds because canonicalMessage re-serializes it to ISO; a sub-
    // second drift would change the signed message and fail verification.
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

    await db('instances').insert({
      id: instanceId,
      user_id: userId,
      label: 'Network Route Test',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: orgId,
      instance_id: instanceId,
      name: 'Network Route Org',
      active: true,
      email: orgId,
      address_line: 'Test Street 1',
      postal_code: '48149',
      city: 'Muenster',
      country_code: 'DE',
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('endpoints').insert({
      identifier: endpointId,
      organization_id: orgId,
      name: 'Network Route FHIR',
      address: endpointAddress,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('endpoint_ips').insert({
      id: uuidv4(),
      endpoint_id: endpointId,
      ip: endpointIp,
      is_fhir: true,
      is_bpe: false,
    });
    await db('memberships').insert({
      id: membershipId,
      organization_id: orgId,
      parent_organization: `parent-${sfx}.example.de`,
      endpoint_id: endpointId,
      roles: JSON.stringify(['DIC']),
      created_at: new Date(),
      updated_at: new Date(),
    });
    // The org only enters the federation set when active AND its latest approval
    // row is APPROVED, mirroring the full-bundle rule the service enforces.
    await db('approval_requests').insert({
      id: approvalId,
      instance_id: instanceId,
      status: 'APPROVED',
      created_at: new Date(),
      submitted_at: new Date(),
      resolved_at: new Date(),
    });

    userToken = getTestToken(email, userId);
    adminToken = getTestToken(adminEmail, adminUserId);
  });

  afterAll(async () => {
    await db('approval_requests').where({ id: approvalId }).del();
    await db('memberships').where({ organization_id: orgId }).del();
    await db('endpoint_ips').where({ endpoint_id: endpointId }).del();
    await db('endpoints').where({ organization_id: orgId }).del();
    await db('organizations').where({ identifier: orgId }).del();
    await db('instances').where({ id: instanceId }).del();
    await db('admin_grants').where({ email: adminEmail }).del();
    await db('users').whereIn('id', [userId, adminUserId]).del();
    await db('email_whitelist').whereIn('email', [email, adminEmail]).del();
  });

  it('returns 200 with the federation projection and meta.isAdmin=false for a non-admin', async () => {
    const res = await request(app)
      .get('/api/v1/network/map')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data.organizations)).toBe(true);
    // A freshly seeded user without a signed admin grant is not an admin.
    expect(res.body.meta).toEqual({ isAdmin: false });

    const orgs = res.body.data.organizations as OrgProjection[];
    const found = orgs.find((o) => o.identifier === orgId);
    expect(found).toBeTruthy();

    // Non-admin endpoints expose only identifier + name — never address or IPs.
    const ep = found!.endpoints.find((e) => e.identifier === endpointId);
    expect(ep).toBeTruthy();
    expect(ep!.name).toBe('Network Route FHIR');
    expect(ep!.address).toBeUndefined();
    expect(ep!.ips).toBeUndefined();
    // Admin-only org fields are absent from the redacted projection.
    expect(found!.email).toBeUndefined();
  });

  it('returns the detailed projection with meta.isAdmin=true for a verified admin', async () => {
    const res = await request(app)
      .get('/api/v1/network/map')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ isAdmin: true });

    const orgs = res.body.data.organizations as OrgProjection[];
    const found = orgs.find((o) => o.identifier === orgId);
    expect(found).toBeTruthy();
    // Admins additionally receive the org email and the endpoint address/IPs.
    expect(found!.email).toBe(orgId);

    const ep = found!.endpoints.find((e) => e.identifier === endpointId);
    expect(ep!.address).toBe(endpointAddress);
    const ips = ep!.ips as Array<Record<string, unknown>>;
    expect(ips.some((i) => i.ip === endpointIp && i.is_fhir === true)).toBe(true);
  });

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/api/v1/network/map');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
