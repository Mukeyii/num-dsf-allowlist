/**
 * instance-ownership.test.ts – requireInstanceOwnership middleware contract:
 * - 403 for non-admin accessing another user's instance
 * - 200 for owner accessing their own instance
 * - 200 for IMI admin accessing any instance (bypass)
 */
import express from 'express';
import request from 'supertest';
import { db } from '../db/connection';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { v4 as uuidv4 } from 'uuid';

process.env.IMI_ADMIN_EMAILS = 'admin@imi-test.example.de';

function appWith(user: { id: string; email: string }) {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = user; next(); });
  app.get('/instances/:id/probe', requireInstanceOwnership, (req, res) => {
    res.json({ ok: true, instance: (req as any).instance });
  });
  return app;
}

describe('requireInstanceOwnership', () => {
  const ownerId = uuidv4();
  const otherId = uuidv4();
  const instanceId = uuidv4();
  const adminEmail = 'admin@imi-test.example.de';

  beforeAll(async () => {
    await db('users').insert([
      { id: ownerId, email: 'owner@example.de', created_at: new Date() },
      { id: otherId, email: 'other@example.de', created_at: new Date() },
    ]);
    await db('instances').insert({ id: instanceId, user_id: ownerId, label: 'L', created_at: new Date() });
  });

  afterAll(async () => {
    await db('instances').where({ id: instanceId }).del();
    await db('users').whereIn('id', [ownerId, otherId]).del();
  });

  it('200 for owner', async () => {
    const res = await request(appWith({ id: ownerId, email: 'owner@example.de' })).get(`/instances/${instanceId}/probe`);
    expect(res.status).toBe(200);
  });

  it('403 for non-admin non-owner', async () => {
    const res = await request(appWith({ id: otherId, email: 'other@example.de' })).get(`/instances/${instanceId}/probe`);
    expect(res.status).toBe(403);
  });

  it('200 for IMI admin even when not owner', async () => {
    const res = await request(appWith({ id: otherId, email: adminEmail })).get(`/instances/${instanceId}/probe`);
    expect(res.status).toBe(200);
  });
});
