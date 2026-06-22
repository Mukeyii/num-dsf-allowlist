// Purpose: Integration tests for the identity endpoint (GET /auth/me)
// Dependencies: supertest, app, db/connection, auth helper, uuid
//
// Uses unique per-suite fixtures (own whitelisted user) so the suite is
// concurrency-safe under parallel jest and cleans up its own rows.

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { app } from '../../app';
import { db } from '../../db/connection';
import { getTestToken } from '../helpers/auth';

describe('Me API – GET /auth/me', () => {
  const sfx = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const userId = uuidv4();
  const email = `route-${sfx}@example.de`;
  let token: string;

  beforeAll(async () => {
    await db('email_whitelist').insert({
      id: uuidv4(),
      email,
      created_by: 'test',
      created_at: new Date(),
    });
    await db('users').insert({ id: userId, email, totp_enabled: false, created_at: new Date() });
    token = getTestToken(email, userId);
  });

  afterAll(async () => {
    await db('users').where({ id: userId }).del();
    await db('email_whitelist').where({ email }).del();
  });

  it('returns the authenticated identity envelope for a valid token', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.email).toBe(email);
    // A freshly seeded user without a signed admin grant is not an admin.
    expect(res.body.data.isAdmin).toBe(false);
  });

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });
});
