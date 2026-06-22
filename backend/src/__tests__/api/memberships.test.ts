// Purpose: Integration tests for the Memberships API (CRUD per instance)
// Dependencies: supertest, app, db connection, auth helper
//
// Self-contained unique fixtures (no shared fixed-ID seed helpers) so the
// suite is concurrency-safe under parallel jest.

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { app } from '../../app';
import { db } from '../../db/connection';
import { getTestToken } from '../helpers/auth';

// The roles column is JSON in MySQL but the driver may surface it as a parsed
// array, a JSON string, or a bare comma-joined string ("DIC,HRP"). Normalize
// all three to a string[] so assertions are stable across driver behavior.
function normalizeRoles(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as string[];
    } catch {
      // not JSON — fall through to comma split
    }
    return raw.split(',').filter(Boolean);
  }
  return [];
}

describe('Memberships API', () => {
  const sfx = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const userId = uuidv4();
  const email = `route-${sfx}@example.de`;
  const instanceId = uuidv4();
  const orgId = `route-${sfx}.example.de`;
  const parentOrg = `parent-${sfx}.example.de`;
  const endpointId = `ep-${sfx}.example.de`;
  let token: string;

  beforeAll(async () => {
    await db('email_whitelist')
      .insert({ id: uuidv4(), email, created_by: 'test', created_at: new Date() })
      .onConflict('email')
      .ignore();
    await db('users')
      .insert({ id: userId, email, totp_enabled: false, created_at: new Date() })
      .onConflict('email')
      .ignore();
    await db('instances').insert({
      id: instanceId,
      user_id: userId,
      label: 'Membership Route Test',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: orgId,
      instance_id: instanceId,
      name: 'Membership Route Org',
      active: true,
      email,
      address_line: 'Test Street 1',
      postal_code: '12345',
      city: 'Teststadt',
      country_code: 'DE',
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('endpoints').insert({
      identifier: endpointId,
      organization_id: orgId,
      name: 'Route Test FHIR',
      address: `https://${endpointId}/fhir`,
      created_at: new Date(),
      updated_at: new Date(),
    });
    token = getTestToken(email, userId);
  });

  afterAll(async () => {
    await db('audit_logs').where({ instance_id: instanceId }).del();
    await db('memberships').where({ organization_id: orgId }).del();
    await db('endpoints').where({ organization_id: orgId }).del();
    await db('organizations').where({ identifier: orgId }).del();
    await db('instances').where({ id: instanceId }).del();
    await db('users').where({ id: userId }).del();
    await db('email_whitelist').where({ email }).del();
  });

  describe('GET /api/v1/instances/:id/memberships', () => {
    it('returns an empty data array when no memberships exist', async () => {
      const res = await request(app)
        .get(`/api/v1/instances/${instanceId}/memberships`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toEqual([]);
    });

    it('rejects requests without an Authorization header', async () => {
      const res = await request(app).get(`/api/v1/instances/${instanceId}/memberships`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/instances/:id/memberships', () => {
    it('creates a membership and returns 201 with the envelope', async () => {
      const res = await request(app)
        .post(`/api/v1/instances/${instanceId}/memberships`)
        .set('Authorization', `Bearer ${token}`)
        .send({ parentOrganization: parentOrg, endpointId, roles: ['DIC'] });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.parent_organization).toBe(parentOrg);
      expect(res.body.data.endpoint_id).toBe(endpointId);
      expect(res.body.data.id).toBeDefined();

      // Clean up so later list/PUT/DELETE tests start from a known state.
      await db('memberships').where({ id: res.body.data.id }).del();
    });

    it('returns 400 when parentOrganization is missing', async () => {
      const res = await request(app)
        .post(`/api/v1/instances/${instanceId}/memberships`)
        .set('Authorization', `Bearer ${token}`)
        .send({ endpointId, roles: ['DIC'] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });

    it('returns 400 when roles contains an unknown role', async () => {
      const res = await request(app)
        .post(`/api/v1/instances/${instanceId}/memberships`)
        .set('Authorization', `Bearer ${token}`)
        .send({ parentOrganization: parentOrg, endpointId, roles: ['BOGUS'] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });
  });

  describe('PUT /api/v1/instances/:id/memberships/:mid', () => {
    it('updates the roles of an existing membership', async () => {
      const created = await request(app)
        .post(`/api/v1/instances/${instanceId}/memberships`)
        .set('Authorization', `Bearer ${token}`)
        .send({ parentOrganization: parentOrg, endpointId, roles: ['DIC'] });
      expect(created.status).toBe(201);
      const mid = created.body.data.id;

      const res = await request(app)
        .put(`/api/v1/instances/${instanceId}/memberships/${mid}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ roles: ['HRP', 'DMS'] });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      // The MySQL JSON column comes back as a raw string from the driver; assert
      // the persisted update reflects the new roles without re-parsing it.
      const roles = normalizeRoles(res.body.data.roles);
      expect(roles).toEqual(['HRP', 'DMS']);

      await db('memberships').where({ id: mid }).del();
    });
  });

  describe('DELETE /api/v1/instances/:id/memberships/:mid', () => {
    it('soft-deletes a membership so it drops out of the list', async () => {
      const created = await request(app)
        .post(`/api/v1/instances/${instanceId}/memberships`)
        .set('Authorization', `Bearer ${token}`)
        .send({ parentOrganization: parentOrg, endpointId, roles: ['DIC'] });
      expect(created.status).toBe(201);
      const mid = created.body.data.id;

      const res = await request(app)
        .delete(`/api/v1/instances/${instanceId}/memberships/${mid}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ deleted: true });

      const list = await request(app)
        .get(`/api/v1/instances/${instanceId}/memberships`)
        .set('Authorization', `Bearer ${token}`);
      expect(list.body.data.find((m: { id: string }) => m.id === mid)).toBeUndefined();

      await db('memberships').where({ id: mid }).del();
    });

    it('returns MEMBERSHIP_NOT_FOUND when deleting an unknown id', async () => {
      const res = await request(app)
        .delete(`/api/v1/instances/${instanceId}/memberships/${uuidv4()}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('MEMBERSHIP_NOT_FOUND');
    });
  });
});
