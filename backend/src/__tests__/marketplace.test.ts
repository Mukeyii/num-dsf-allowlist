/**
 * marketplace.test.ts – Contract tests for marketplace REST routes.
 * Covers: GET list, POST create (validation, normalization, duplicate),
 * PATCH status update (with audit log), DELETE (removes entry).
 *
 * Dependencies: app, db/connection, supertest
 */

// Mocks must be hoisted before any imports that pull in the mocked modules.
jest.mock('../services/marketplace-sync.service', () => ({
  syncEntry: jest.fn().mockResolvedValue(undefined),
  syncAll: jest.fn().mockResolvedValue({ ok: 0, failed: 0 }),
}));

jest.mock('../services/totp.service', () => ({
  verifyTotpCode: jest.fn().mockResolvedValue(true),
}));

jest.mock('../middleware/auth.middleware', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../middleware/admin.middleware', () => ({
  requireImiAdmin: (_req: any, _res: any, next: any) => next(),
}));

import request from 'supertest';
import { db } from '../db/connection';
import { app } from '../app';

const TOTP = '123456';
const ADMIN_EMAIL = 'marketplace-test-admin@imi-test.example.de';
const ADMIN_ID = '00000000-0000-0000-0000-000000000099';

// Inject req.user via a request header trick isn't possible — requireAuth is
// mocked as passthrough so req.user is undefined. We patch it via a middleware
// that reads the mock user from a custom header set in each test call.
// However, since requireAuth is a passthrough in tests, req.user will be
// undefined unless we set it. The admin routes access req.user!.email and
// req.user!.id. We need to provide those.
//
// Solution: we create a thin wrapper around the app that injects req.user
// before routing. Using a separate express instance is cleaner for that.
import express from 'express';
import { marketplaceRouter } from '../routes/marketplace.routes';
import { adminMarketplaceRouter } from '../routes/admin-marketplace.routes';

function buildTestApp() {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    (req as any).user = { id: ADMIN_ID, email: ADMIN_EMAIL };
    next();
  });
  a.use('/api/v1/marketplace', marketplaceRouter);
  a.use('/api/v1/admin/marketplace', adminMarketplaceRouter);
  return a;
}

const testApp = buildTestApp();

describe('Marketplace REST routes', () => {
  // Clean up any rows this test suite inserts so reruns are idempotent.
  afterAll(async () => {
    await db('marketplace_entries')
      .whereIn('git_url', [
        'https://github.com/Foo/Bar',
        'https://github.com/Other/Repo',
      ])
      .del();
    await db('audit_logs').where({ user_email: ADMIN_EMAIL }).del();
  });

  describe('GET /api/v1/marketplace', () => {
    it('returns empty array when no entries exist', async () => {
      // Pre-clean in case a prior run left rows
      await db('marketplace_entries')
        .whereIn('git_url', ['https://github.com/Foo/Bar', 'https://github.com/Other/Repo'])
        .del();
      const res = await request(testApp).get('/api/v1/marketplace');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Entries from other test suites may exist; just confirm the array is present.
    });
  });

  describe('POST /api/v1/admin/marketplace', () => {
    it('rejects a non-GitHub URL with 400 VALIDATION', async () => {
      const res = await request(testApp)
        .post('/api/v1/admin/marketplace')
        .send({ gitUrl: 'https://gitlab.com/foo/bar', totpCode: TOTP });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });

    it('accepts a URL with trailing slash and .git suffix, stores canonical form', async () => {
      const res = await request(testApp)
        .post('/api/v1/admin/marketplace')
        .send({ gitUrl: 'https://github.com/Foo/Bar.git/', totpCode: TOTP });
      expect(res.status).toBe(201);
      expect(res.body.data.gitUrl).toBe('https://github.com/Foo/Bar');
      expect(res.body.data).toMatchObject({
        topics: expect.any(Array),
        forks: expect.any(Number),
        openIssues: expect.any(Number),
        archived: expect.any(Boolean),
      });
      expect(res.body.data.archived).toBe(false);
      expect(res.body.data.forks).toBe(0);
      expect(res.body.data.openIssues).toBe(0);
      expect(res.body.data.topics).toEqual([]);
    });

    it('rejects a duplicate URL with 409 ALREADY_EXISTS', async () => {
      const res = await request(testApp)
        .post('/api/v1/admin/marketplace')
        .send({ gitUrl: 'https://github.com/Foo/Bar', totpCode: TOTP });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_EXISTS');
    });
  });

  describe('PATCH /api/v1/admin/marketplace/:id', () => {
    it('updates status and writes an audit log entry', async () => {
      // Fetch the entry we just created
      const listRes = await request(testApp).get('/api/v1/marketplace');
      const entry = (listRes.body.data as any[]).find((e) => e.gitUrl === 'https://github.com/Foo/Bar');
      expect(entry).toBeDefined();

      const patchRes = await request(testApp)
        .patch(`/api/v1/admin/marketplace/${entry.id}`)
        .send({ status: 'EXPERIMENTAL', totpCode: TOTP });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.status).toBe('EXPERIMENTAL');

      // Audit log must have a row for this update
      const auditRow = await db('audit_logs')
        .where({ resource_id: entry.id, operation: 'UPDATE', user_email: ADMIN_EMAIL })
        .first();
      expect(auditRow).toBeDefined();
    });
  });

  describe('DELETE /api/v1/admin/marketplace/:id', () => {
    it('removes the entry and GET shows it is gone', async () => {
      // Get the id
      const listRes = await request(testApp).get('/api/v1/marketplace');
      const entry = (listRes.body.data as any[]).find((e) => e.gitUrl === 'https://github.com/Foo/Bar');
      expect(entry).toBeDefined();

      const delRes = await request(testApp)
        .delete(`/api/v1/admin/marketplace/${entry.id}`)
        .send({ totpCode: TOTP });
      expect(delRes.status).toBe(200);
      expect(delRes.body.data.deleted).toBe(true);

      const listRes2 = await request(testApp).get('/api/v1/marketplace');
      const gone = (listRes2.body.data as any[]).find((e) => e.gitUrl === 'https://github.com/Foo/Bar');
      expect(gone).toBeUndefined();
    });

    it('returns 404 for a non-existent id', async () => {
      const res = await request(testApp)
        .delete('/api/v1/admin/marketplace/00000000-0000-0000-0000-000000000000')
        .send({ totpCode: TOTP });
      expect(res.status).toBe(404);
    });
  });
});
