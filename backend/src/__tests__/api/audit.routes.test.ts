// Purpose: Integration tests for the per-instance Audit API (GET /api/v1/instances/:id/audit)
// Dependencies: supertest, app, db/connection, auth helper, uuid
//
// Uses unique per-suite fixtures (own user/instance/org + audit_logs rows) so the
// suite is concurrency-safe under parallel jest and tears its own rows down.

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { app } from '../../app';
import { db } from '../../db/connection';
import { getTestToken } from '../helpers/auth';

describe('Audit API – GET /api/v1/instances/:id/audit', () => {
  const sfx = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const userId = uuidv4();
  const email = `route-${sfx}@example.de`;
  const instanceId = uuidv4();
  const orgId = `route-${sfx}.example.de`;
  let token: string;

  // Newest-last in this array so timestamp ordering is testable.
  const base = Date.now();
  const seedRows = [
    { resource_type: 'ORGANIZATION', operation: 'CREATE', offset: 0 },
    { resource_type: 'CONTACT', operation: 'CREATE', offset: 1000 },
    { resource_type: 'CONTACT', operation: 'UPDATE', offset: 2000 },
    { resource_type: 'CONTACT', operation: 'DELETE', offset: 3000 },
    { resource_type: 'ENDPOINT', operation: 'CREATE', offset: 4000 },
  ];

  beforeAll(async () => {
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
      label: 'audit-route',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: orgId,
      instance_id: instanceId,
      name: 'Audit Route Org',
      active: true,
      email,
      created_at: new Date(),
      updated_at: new Date(),
    });
    for (const r of seedRows) {
      await db('audit_logs').insert({
        id: uuidv4(),
        timestamp: new Date(base + r.offset),
        user_email: email,
        instance_id: instanceId,
        resource_type: r.resource_type,
        resource_id: uuidv4(),
        operation: r.operation,
        diff_json: null,
        ip_address: '127.0.0.1',
      });
    }
    token = getTestToken(email, userId);
  });

  afterAll(async () => {
    await db('audit_logs').where({ instance_id: instanceId }).del();
    await db('organizations').where({ instance_id: instanceId }).del();
    await db('instances').where({ id: instanceId }).del();
    await db('users').where({ id: userId }).del();
    await db('email_whitelist').where({ email }).del();
  });

  it('returns the instance rows with pagination meta, newest-first', async () => {
    const res = await request(app)
      .get(`/api/v1/instances/${instanceId}/audit`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(seedRows.length);
    // orderBy timestamp desc → newest (largest offset) first.
    expect(res.body.data[0].resource_type).toBe('ENDPOINT');
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 50,
      total: seedRows.length,
      pages: 1,
    });
  });

  it('narrows results with the resource= filter', async () => {
    const res = await request(app)
      .get(`/api/v1/instances/${instanceId}/audit`)
      .query({ resource: 'CONTACT' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(
      res.body.data.every((r: { resource_type: string }) => r.resource_type === 'CONTACT'),
    ).toBe(true);
    expect(res.body.meta.total).toBe(3);
  });

  it('narrows results with the operation= filter', async () => {
    const res = await request(app)
      .get(`/api/v1/instances/${instanceId}/audit`)
      .query({ resource: 'CONTACT', operation: 'UPDATE' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].resource_type).toBe('CONTACT');
    expect(res.body.data[0].operation).toBe('UPDATE');
    expect(res.body.meta.total).toBe(1);
  });

  it('paginates: total stays full while each page is bounded by limit', async () => {
    const p1 = await request(app)
      .get(`/api/v1/instances/${instanceId}/audit`)
      .query({ page: 1, limit: 2 })
      .set('Authorization', `Bearer ${token}`);
    const p2 = await request(app)
      .get(`/api/v1/instances/${instanceId}/audit`)
      .query({ page: 2, limit: 2 })
      .set('Authorization', `Bearer ${token}`);
    const p3 = await request(app)
      .get(`/api/v1/instances/${instanceId}/audit`)
      .query({ page: 3, limit: 2 })
      .set('Authorization', `Bearer ${token}`);

    expect(p1.status).toBe(200);
    expect(p1.body.meta).toMatchObject({ page: 1, limit: 2, total: seedRows.length, pages: 3 });
    expect(p1.body.data).toHaveLength(2);
    expect(p2.body.data).toHaveLength(2);
    expect(p3.body.data).toHaveLength(1);
    const ids = [...p1.body.data, ...p2.body.data, ...p3.body.data].map(
      (r: { id: string }) => r.id,
    );
    expect(new Set(ids).size).toBe(seedRows.length); // no overlap across pages
  });

  it('rejects an out-of-enum resource filter with 400', async () => {
    const res = await request(app)
      .get(`/api/v1/instances/${instanceId}/audit`)
      .query({ resource: 'NOT_A_RESOURCE' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get(`/api/v1/instances/${instanceId}/audit`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});
