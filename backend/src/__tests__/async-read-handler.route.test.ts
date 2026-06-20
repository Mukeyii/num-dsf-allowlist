/**
 * async-read-handler.route.test.ts – Proves a rejecting read handler is caught.
 *
 * The marketplace list GET handler is wrapped in asyncHandler. When the
 * underlying service read rejects (e.g. a transient DB/Redis hiccup), the
 * wrapper must answer the request with a handled error response instead of
 * leaving the promise rejection unhandled and the request hanging.
 *
 * Dependencies: marketplace.routes, asyncHandler, supertest
 */

// Hoisted before the router import so the router picks up the mocked service.
jest.mock('../services/marketplace.service', () => ({
  listEntries: jest.fn().mockRejectedValue(new Error('DB_UNAVAILABLE')),
  getEntryBySlug: jest.fn(),
}));

jest.mock('../middleware/auth.middleware', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

import express from 'express';
import request from 'supertest';
import { marketplaceRouter } from '../routes/marketplace.routes';

function buildTestApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/v1/marketplace', marketplaceRouter);
  return a;
}

const testApp = buildTestApp();

describe('asyncHandler-wrapped read handler', () => {
  it('answers with a handled error when the service read rejects, instead of hanging', async () => {
    const res = await request(testApp).get('/api/v1/marketplace');
    // asyncHandler caught the rejection and sent a response (default 400 +
    // sanitized error) rather than leaving the request open. A raw async
    // handler would never respond and the request would time out.
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
