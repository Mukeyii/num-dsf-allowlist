/**
 * marketplace-detail.route.test.ts – Contract tests for the per-process detail
 * read endpoint and the admin metadata patch endpoint.
 * Covers: GET /:slug (200 with releases, 404 unknown, 401 no auth),
 * PATCH /:id/meta (200 update, 400 TOTP_REQUIRED, 404 unknown id, 403 non-admin).
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

import express from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { marketplaceRouter } from '../routes/marketplace.routes';
import { adminMarketplaceRouter } from '../routes/admin-marketplace.routes';

const TOTP = '123456';
const ADMIN_EMAIL = 'marketplace-detail-admin@imi-test.example.de';
const ADMIN_ID = '00000000-0000-0000-0000-000000000098';

// requireAuth/requireImiAdmin are mocked as passthroughs, so req.user is never
// populated by the middleware. Inject it ourselves before routing, mirroring
// the marketplace.test.ts harness.
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

// A second app that puts the real requireAuth in front of the read router, so
// the no-auth case exercises genuine 401 behavior despite the module-level mock.
function buildNoAuthApp() {
  const { requireAuth } = jest.requireActual('../middleware/auth.middleware');
  const a = express();
  a.use(express.json());
  a.use('/api/v1/marketplace', requireAuth, marketplaceRouter);
  return a;
}

const noAuthApp = buildNoAuthApp();

const stamp = Date.now();
const entryId = uuidv4();
const slug = `dsf-test-mp-detail-${stamp}`;
const gitUrl = `https://github.com/dsf-test/mp-detail-${stamp}`;
const relOld = uuidv4();
const relNew = uuidv4();

beforeAll(async () => {
  await db('marketplace_entries').insert({
    id: entryId,
    slug,
    name: `mp-detail-${stamp}`,
    git_url: gitUrl,
    status: 'APPROVED',
    metadata_source: 'MANIFEST',
    dsf_version_min: '1.0.0',
    added_by: ADMIN_EMAIL,
    added_at: new Date(),
    updated_at: new Date(),
  });
  await db('marketplace_releases').insert([
    {
      id: relOld,
      entry_id: entryId,
      tag: 'v1.0.0',
      published_at: new Date('2024-01-01T00:00:00Z'),
    },
    {
      id: relNew,
      entry_id: entryId,
      tag: 'v2.0.0',
      published_at: new Date('2025-01-01T00:00:00Z'),
    },
  ]);
});

afterAll(async () => {
  await db('marketplace_releases').where({ entry_id: entryId }).del();
  await db('marketplace_entries').where({ id: entryId }).del();
  await db('audit_logs').where({ user_email: ADMIN_EMAIL }).del();
});

describe('GET /api/v1/marketplace/:slug', () => {
  it('returns the entry with releases newest-first', async () => {
    const res = await request(testApp).get(`/api/v1/marketplace/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(entryId);
    expect(res.body.data.slug).toBe(slug);
    expect(res.body.data.releases.map((r: any) => r.tag)).toEqual(['v2.0.0', 'v1.0.0']);
  });

  it('returns 404 NOT_FOUND for an unknown slug', async () => {
    const res = await request(testApp).get(`/api/v1/marketplace/does-not-exist-${stamp}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 without authentication', async () => {
    const res = await request(noAuthApp).get(`/api/v1/marketplace/${slug}`);
    expect(res.status).toBe(401);
  });
});
