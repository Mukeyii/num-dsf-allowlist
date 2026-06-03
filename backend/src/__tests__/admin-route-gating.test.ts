/**
 * admin-route-gating.test.ts — every /api/v1/admin/* endpoint must refuse a
 * non-admin caller with 403. Smokes one route per admin sub-router to catch
 * accidentally-missing `requireAdmin` middleware in any of them.
 *
 * Dependencies: supertest, app, helpers/seed (seedTestUser non-admin),
 * helpers/auth (getTestToken).
 */
import request from 'supertest';
import { app } from '../app';
import { cleanTestData, seedTestUser } from './helpers/seed';
import { getTestToken } from './helpers/auth';

interface AdminRoute {
  method: 'get' | 'post' | 'delete';
  path: string;
}

const ADMIN_ROUTES: AdminRoute[] = [
  { method: 'get', path: '/api/v1/admin/instances' },
  { method: 'get', path: '/api/v1/admin/audit' },
  { method: 'get', path: '/api/v1/admin/users' },
  { method: 'get', path: '/api/v1/admin/promotions' },
  { method: 'get', path: '/api/v1/admin/ca-blacklist' },
  { method: 'get', path: '/api/v1/admin/bundle-versions' },
  { method: 'get', path: '/api/v1/admin/marketplace' },
];

describe('admin-route gating', () => {
  let token: string;

  beforeAll(async () => {
    await cleanTestData();
    const { userId, email } = await seedTestUser();
    token = getTestToken(email, userId);
  });

  it.each(ADMIN_ROUTES)('non-admin gets 403 on $method $path', async (route) => {
    const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)
      [route.method](route.path)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
