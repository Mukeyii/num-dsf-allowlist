// Purpose: Integration tests for the Auth API (/auth/request-otp)
// Dependencies: supertest, app, seed helpers

import request from 'supertest';
import { app } from '../../app';
import { cleanTestData, seedTestUser, TEST_EMAIL } from '../helpers/seed';

describe('Auth API', () => {
  beforeEach(async () => {
    await cleanTestData();
  });

  describe('POST /auth/request-otp', () => {
    it('should return 200 for whitelisted email', async () => {
      await seedTestUser();
      const res = await request(app).post('/auth/request-otp').send({ email: TEST_EMAIL });
      expect(res.status).toBe(200);
    });

    it('should return 200 for non-whitelisted email (no leaking)', async () => {
      const res = await request(app)
        .post('/auth/request-otp')
        .send({ email: 'unknown@example.com' });
      expect(res.status).toBe(200);
    });

    it('should return 400 for missing email', async () => {
      const res = await request(app).post('/auth/request-otp').send({});
      expect(res.status).toBe(400);
    });
  });
});
