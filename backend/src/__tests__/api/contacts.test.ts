// Purpose: Integration tests for the Contacts API (CRUD per instance)
// Dependencies: supertest, app, seed helpers, auth helper

import request from 'supertest';
import { app } from '../../app';
import {
  cleanTestData,
  seedTestUser,
  seedOrganization,
  seedContact,
  TEST_INSTANCE_ID,
} from '../helpers/seed';
import { getTestToken } from '../helpers/auth';

describe('Contacts API', () => {
  let token: string;
  beforeEach(async () => {
    await cleanTestData();
    const { email } = await seedTestUser();
    await seedOrganization();
    token = getTestToken(email);
  });

  describe('GET /api/v1/instances/:id/contacts', () => {
    it('should return empty array when no contacts', async () => {
      const res = await request(app)
        .get(`/api/v1/instances/${TEST_INSTANCE_ID}/contacts`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return contacts when they exist', async () => {
      await seedContact();
      const res = await request(app)
        .get(`/api/v1/instances/${TEST_INSTANCE_ID}/contacts`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Dr. Test');
    });
  });

  describe('POST /api/v1/instances/:id/contacts', () => {
    it('should create a new contact', async () => {
      const res = await request(app)
        .post(`/api/v1/instances/${TEST_INSTANCE_ID}/contacts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ types: ['DSF_ADMIN'], name: 'New Contact', email: 'new@test-hospital.de' });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('New Contact');
    });
  });

  describe('PUT /api/v1/instances/:id/contacts/:cid', () => {
    it('should update an existing contact', async () => {
      const contactId = await seedContact();
      const res = await request(app)
        .put(`/api/v1/instances/${TEST_INSTANCE_ID}/contacts/${contactId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ types: ['SECURITY'], name: 'Updated Contact', email: 'updated@test.de' });
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Contact');
    });
  });

  describe('DELETE /api/v1/instances/:id/contacts/:cid', () => {
    it('should delete a contact', async () => {
      const contactId = await seedContact();
      const res = await request(app)
        .delete(`/api/v1/instances/${TEST_INSTANCE_ID}/contacts/${contactId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const check = await request(app)
        .get(`/api/v1/instances/${TEST_INSTANCE_ID}/contacts`)
        .set('Authorization', `Bearer ${token}`);
      expect(check.body.data).toHaveLength(0);
    });
  });
});
