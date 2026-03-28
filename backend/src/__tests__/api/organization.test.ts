// Purpose: Integration tests for the Organization API (GET/PUT per instance)
// Dependencies: supertest, app, seed helpers, auth helper

import request from 'supertest';
import { app } from '../../app';
import { cleanTestData, seedTestUser, seedOrganization, TEST_INSTANCE_ID } from '../helpers/seed';
import { getTestToken } from '../helpers/auth';

describe('Organization API', () => {
  let token: string;
  beforeEach(async () => {
    await cleanTestData();
    const { email } = await seedTestUser();
    token = getTestToken(email);
  });

  describe('GET /api/v1/instances/:id/organization', () => {
    it('should return null when no organization exists', async () => {
      const res = await request(app).get(`/api/v1/instances/${TEST_INSTANCE_ID}/organization`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    it('should return organization when it exists', async () => {
      await seedOrganization();
      const res = await request(app).get(`/api/v1/instances/${TEST_INSTANCE_ID}/organization`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Test Hospital');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get(`/api/v1/instances/${TEST_INSTANCE_ID}/organization`);
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/v1/instances/:id/organization', () => {
    it('should create organization (upsert)', async () => {
      const res = await request(app).put(`/api/v1/instances/${TEST_INSTANCE_ID}/organization`).set('Authorization', `Bearer ${token}`)
        .send({ identifier: 'new-org.de', name: 'New Org', email: 'admin@new-org.de', active: true });
      expect(res.status).toBe(200);
      expect(res.body.data.identifier).toBe('new-org.de');
    });

    it('should update existing organization', async () => {
      await seedOrganization();
      const res = await request(app).put(`/api/v1/instances/${TEST_INSTANCE_ID}/organization`).set('Authorization', `Bearer ${token}`)
        .send({ identifier: 'test-hospital.de', name: 'Updated Hospital', email: 'updated@test.de', active: true });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Hospital');
    });
  });
});
