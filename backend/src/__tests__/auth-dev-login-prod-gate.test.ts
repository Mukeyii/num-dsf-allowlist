/**
 * auth-dev-login-prod-gate.test.ts — proves the /auth/dev-login route is
 * NOT registered in production. The route is gated at module-load time on
 * `isDevEnv() && DEV_AUTO_LOGIN === 'true'`, where isDevEnv() is a positive
 * development/test allowlist. We assert the gate appears in source AND verify
 * behavior by re-requiring the router with NODE_ENV=production set.
 *
 * Dependencies: fs (source-scan), supertest (runtime), express.
 */
import fs from 'fs';
import path from 'path';

const ROUTES_SRC = fs.readFileSync(path.join(__dirname, '..', 'routes', 'auth.routes.ts'), 'utf8');

describe('/auth/dev-login route gating', () => {
  it('is registered under an isDevEnv() allowlist guard in source', () => {
    expect(ROUTES_SRC).toMatch(/isDevEnv\(\)\s*&&[\s\S]{0,80}DEV_AUTO_LOGIN/);
  });

  it('requires DEV_AUTO_LOGIN === "true" in source', () => {
    expect(ROUTES_SRC).toMatch(/DEV_AUTO_LOGIN\s*===\s*['"]true['"]/);
  });

  it('returns 404 when NODE_ENV is production (route is never registered)', async () => {
    const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
    const ORIGINAL_DEV_AUTO_LOGIN = process.env.DEV_AUTO_LOGIN;
    process.env.NODE_ENV = 'production';
    process.env.DEV_AUTO_LOGIN = 'true'; // even with this set, prod must refuse
    jest.resetModules();
    try {
      // Re-require with the new env so the conditional re-evaluates.
      const express = require('express');
      const { authRouter } = require('../routes/auth.routes');
      const app = express();
      app.use(express.json());
      app.use('/auth', authRouter);
      const request = require('supertest');
      const res = await request(app).post('/auth/dev-login').send({ role: 'admin' });
      expect(res.status).toBe(404);
    } finally {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
      if (ORIGINAL_DEV_AUTO_LOGIN === undefined) delete process.env.DEV_AUTO_LOGIN;
      else process.env.DEV_AUTO_LOGIN = ORIGINAL_DEV_AUTO_LOGIN;
      jest.resetModules();
    }
  });
});
