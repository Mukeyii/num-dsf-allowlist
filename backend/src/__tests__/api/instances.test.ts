// Purpose: Integration tests for the Instances API (list, create, show)
// Dependencies: supertest, app, db (Knex), auth helper, uuid
//
// Concurrency-safe: every suite seeds its OWN rows under unique ids and tears
// them down in afterAll, so it never collides with other parallel jest workers.

import request from 'supertest';
import { app } from '../../app';
import { db } from '../../db/connection';
import { getTestToken } from '../helpers/auth';
import { v4 as uuidv4 } from 'uuid';

interface Fixture {
  userId: string;
  email: string;
  instanceId: string;
  orgId: string;
  token: string;
}

async function seedFixture(): Promise<Fixture> {
  const sfx = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const userId = uuidv4();
  const email = `route-${sfx}@example.de`;
  const instanceId = uuidv4();
  const orgId = `route-${sfx}.example.de`;

  await db('email_whitelist').insert({
    id: uuidv4(),
    email,
    created_by: 'test',
    created_at: new Date(),
  });
  await db('users').insert({ id: userId, email, totp_enabled: false, created_at: new Date() });
  await db('instances').insert({
    id: instanceId,
    user_id: userId,
    label: `Instance ${sfx}`,
    created_at: new Date(),
  });
  await db('organizations').insert({
    identifier: orgId,
    instance_id: instanceId,
    name: `Org ${sfx}`,
    active: true,
    email,
    address_line: 'Test Street 1',
    postal_code: '12345',
    city: 'Teststadt',
    country_code: 'DE',
    created_at: new Date(),
    updated_at: new Date(),
  });

  return { userId, email, instanceId, orgId, token: getTestToken(email, userId) };
}

async function teardownFixture(f: Fixture): Promise<void> {
  // Children first to respect FKs: audit rows referencing the instance, the
  // org under it, then the instance, user and whitelist row.
  await db('audit_logs').where({ instance_id: f.instanceId }).del();
  await db('audit_logs').where({ user_email: f.email }).del();
  await db('organizations').where({ instance_id: f.instanceId }).del();
  await db('instances').where({ user_id: f.userId }).del();
  await db('users').where({ id: f.userId }).del();
  await db('email_whitelist').where({ email: f.email }).del();
}

describe('Instances API', () => {
  // Primary user (owns instanceA) and a second isolated user (owns instanceB).
  let a: Fixture;
  let b: Fixture;
  // Track instances created via POST so we can clean them up too.
  const createdInstanceIds: string[] = [];

  beforeAll(async () => {
    a = await seedFixture();
    b = await seedFixture();
  });

  afterAll(async () => {
    for (const id of createdInstanceIds) {
      await db('audit_logs').where({ instance_id: id }).del();
      await db('instances').where({ id }).del();
    }
    await teardownFixture(a);
    await teardownFixture(b);
  });

  describe('GET /api/v1/instances', () => {
    it('returns the seeded instance for the token owner in the envelope', async () => {
      const res = await request(app)
        .get('/api/v1/instances')
        .set('Authorization', `Bearer ${a.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);

      const ids = res.body.data.map((i: { id: string }) => i.id);
      expect(ids).toContain(a.instanceId);
      // The list label preference is the associated org's identifier (FQDN).
      const own = res.body.data.find((i: { id: string }) => i.id === a.instanceId);
      expect(own.label).toBe(a.orgId);
      expect(own.user_id).toBe(a.userId);
    });

    it("does not leak another user's instance", async () => {
      const res = await request(app)
        .get('/api/v1/instances')
        .set('Authorization', `Bearer ${a.token}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((i: { id: string }) => i.id);
      expect(ids).not.toContain(b.instanceId);
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/instances');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/instances', () => {
    it('creates a new instance and returns it in the envelope', async () => {
      const res = await request(app)
        .post('/api/v1/instances')
        .set('Authorization', `Bearer ${a.token}`);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body.data.user_id).toBe(a.userId);
      createdInstanceIds.push(res.body.data.id);

      // It is now visible in the owner's list.
      const list = await request(app)
        .get('/api/v1/instances')
        .set('Authorization', `Bearer ${a.token}`);
      const ids = list.body.data.map((i: { id: string }) => i.id);
      expect(ids).toContain(res.body.data.id);
    });

    it('rejects an unauthenticated create with 401', async () => {
      const res = await request(app).post('/api/v1/instances');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/instances/:id', () => {
    it('returns the owned instance with the owner email', async () => {
      const res = await request(app)
        .get(`/api/v1/instances/${a.instanceId}`)
        .set('Authorization', `Bearer ${a.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(a.instanceId);
      expect(res.body.data.owner_email).toBe(a.email);
    });

    it('returns 404 for an instance the user does not own', async () => {
      // User A asks for user B's instance — non-admins are scoped to their own
      // rows, so the route responds 404 (existence is not leaked).
      const res = await request(app)
        .get(`/api/v1/instances/${b.instanceId}`)
        .set('Authorization', `Bearer ${a.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for an unknown instance id', async () => {
      const res = await request(app)
        .get(`/api/v1/instances/${uuidv4()}`)
        .set('Authorization', `Bearer ${a.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects an unauthenticated request with 401', async () => {
      const res = await request(app).get(`/api/v1/instances/${a.instanceId}`);
      expect(res.status).toBe(401);
    });
  });
});
