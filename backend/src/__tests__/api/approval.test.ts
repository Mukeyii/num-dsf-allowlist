// Purpose: Integration tests for the Approval API (submit, status, admin pending/approve/reject)
// Dependencies: supertest, app, seed helpers, auth helper

import request from 'supertest';
import { app } from '../../app';
import {
  cleanTestData,
  seedTestUser,
  seedAdminUser,
  seedOrganization,
  TEST_INSTANCE_ID,
  TEST_ADMIN_EMAIL,
} from '../helpers/seed';
import { getTestToken } from '../helpers/auth';

describe('Approval API', () => {
  let userToken: string;
  let adminToken: string;

  beforeEach(async () => {
    await cleanTestData();
    const { email } = await seedTestUser();
    await seedAdminUser();
    await seedOrganization();
    userToken = getTestToken(email);
    adminToken = getTestToken(TEST_ADMIN_EMAIL, '00000000-0000-0000-0000-000000000002');
  });

  describe('POST /api/v1/instances/:id/approval/submit', () => {
    it('should submit an approval request', async () => {
      const res = await request(app)
        .post(`/api/v1/instances/${TEST_INSTANCE_ID}/approval/submit`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING');
    });

    it('should reject duplicate pending requests', async () => {
      await request(app)
        .post(`/api/v1/instances/${TEST_INSTANCE_ID}/approval/submit`)
        .set('Authorization', `Bearer ${userToken}`);
      const res = await request(app)
        .post(`/api/v1/instances/${TEST_INSTANCE_ID}/approval/submit`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('APPROVAL_ALREADY_PENDING');
    });
  });

  describe('GET /api/v1/instances/:id/approval/status', () => {
    it('should return null when no requests exist', async () => {
      const res = await request(app)
        .get(`/api/v1/instances/${TEST_INSTANCE_ID}/approval/status`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    it('should return latest status', async () => {
      await request(app)
        .post(`/api/v1/instances/${TEST_INSTANCE_ID}/approval/submit`)
        .set('Authorization', `Bearer ${userToken}`);
      const res = await request(app)
        .get(`/api/v1/instances/${TEST_INSTANCE_ID}/approval/status`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PENDING');
    });
  });

  describe('GET /api/v1/admin/approval/pending', () => {
    it('should return pending for admins', async () => {
      await request(app)
        .post(`/api/v1/instances/${TEST_INSTANCE_ID}/approval/submit`)
        .set('Authorization', `Bearer ${userToken}`);
      const res = await request(app)
        .get('/api/v1/admin/approval/pending')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should reject non-admin users', async () => {
      const res = await request(app)
        .get('/api/v1/admin/approval/pending')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
  });
});
