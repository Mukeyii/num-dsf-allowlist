// Purpose: Integration tests for the Endpoints API (CRUD per instance, incl. IP addresses)
// Dependencies: supertest, app, seed helpers, auth helper

import request from 'supertest';
import { app } from '../../app';
import { cleanTestData, seedTestUser, seedOrganization, seedEndpoint, TEST_INSTANCE_ID } from '../helpers/seed';
import { getTestToken } from '../helpers/auth';

describe('Endpoints API', () => {
  let token: string;
  beforeEach(async () => {
    await cleanTestData();
    const { email } = await seedTestUser();
    await seedOrganization();
    token = getTestToken(email);
  });

  describe('GET /api/v1/instances/:id/endpoints', () => {
    it('should return empty array when no endpoints', async () => {
      const res = await request(app).get(`/api/v1/instances/${TEST_INSTANCE_ID}/endpoints`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return endpoints with IP addresses', async () => {
      await seedEndpoint();
      const res = await request(app).get(`/api/v1/instances/${TEST_INSTANCE_ID}/endpoints`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].ipAddresses).toHaveLength(1);
      expect(res.body.data[0].ipAddresses[0].ip).toBe('10.0.0.1');
    });
  });

  describe('POST /api/v1/instances/:id/endpoints', () => {
    it('should create endpoint with IP addresses', async () => {
      const res = await request(app).post(`/api/v1/instances/${TEST_INSTANCE_ID}/endpoints`).set('Authorization', `Bearer ${token}`)
        .send({ identifier: 'new-ep.de', name: 'New EP', address: 'https://new-ep.de/fhir', ipAddresses: [{ ip: '192.168.1.1', isFhir: true, isBpe: false }] });
      expect(res.status).toBe(201);
    });
  });

  describe('DELETE /api/v1/instances/:id/endpoints/:eid', () => {
    it('should delete endpoint and its IPs', async () => {
      const eid = await seedEndpoint();
      const res = await request(app).delete(`/api/v1/instances/${TEST_INSTANCE_ID}/endpoints/${eid}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });
});
