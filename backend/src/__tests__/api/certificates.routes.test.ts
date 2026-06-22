// Purpose: Integration tests for the Certificates API (GET/POST/DELETE per instance)
// Dependencies: supertest, app, db/connection (Knex), node-forge, auth helper

import request from 'supertest';
import forge from 'node-forge';
import { v4 as uuidv4 } from 'uuid';
import { app } from '../../app';
import { db } from '../../db/connection';
import { getTestToken } from '../helpers/auth';

// Concurrency-safe fixture: every value is unique to this suite so it can run
// in parallel with other jest workers without colliding on fixed ids.
const sfx = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const userId = uuidv4();
const email = `route-${sfx}@example.de`;
const instanceId = uuidv4();
const orgId = `route-${sfx}.example.de`;

// Build a self-issued leaf cert PEM in-process. The issuer O is unique so the
// CA-blacklist gate never matches a pre-existing deny-list entry. The private
// key is generated only to sign the leaf and is never stored or returned.
function generateLeafPem(): string {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
  const attrs = [
    { shortName: 'CN', value: `dsf-fhir.${orgId}` },
    { shortName: 'O', value: `RouteTestCA-${sfx}` },
    { shortName: 'C', value: 'DE' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  return forge.pki.certificateToPem(cert);
}

let token: string;

beforeAll(async () => {
  await db('email_whitelist').insert({
    id: uuidv4(),
    email,
    created_by: 'test',
    created_at: new Date(),
  });
  await db('users').insert({
    id: userId,
    email,
    totp_enabled: false,
    created_at: new Date(),
  });
  await db('instances').insert({
    id: instanceId,
    user_id: userId,
    label: 'cert-route-test',
    created_at: new Date(),
  });
  await db('organizations').insert({
    identifier: orgId,
    instance_id: instanceId,
    name: 'Cert Route Test',
    active: true,
    email: `admin@${orgId}`,
    address_line: 'Test Street 1',
    postal_code: '12345',
    city: 'Teststadt',
    country_code: 'DE',
    created_at: new Date(),
    updated_at: new Date(),
  });
  token = getTestToken(email, userId);
});

afterAll(async () => {
  // Children first, then parents, to respect the FK chain.
  await db('audit_logs').where({ instance_id: instanceId }).del();
  await db('certificates').where({ organization_id: orgId }).del();
  await db('organizations').where({ identifier: orgId }).del();
  await db('instances').where({ id: instanceId }).del();
  await db('users').where({ id: userId }).del();
  await db('email_whitelist').where({ email }).del();
  await db.destroy();
});

describe('Certificates API', () => {
  describe('auth guard', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await request(app).get(`/api/v1/instances/${instanceId}/certificates`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/v1/instances/:id/certificates', () => {
    it('stores a public leaf certificate and returns 201 with the envelope', async () => {
      const pem = generateLeafPem();
      const res = await request(app)
        .post(`/api/v1/instances/${instanceId}/certificates`)
        .set('Authorization', `Bearer ${token}`)
        .send({ pem });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.error).toBeUndefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.organization_id).toBe(orgId);
      expect(typeof res.body.data.thumbprint).toBe('string');
      expect(res.body.data.thumbprint).toHaveLength(64);

      // Confirm it was actually persisted under this org.
      const row = await db('certificates').where({ id: res.body.data.id }).first();
      expect(row).toBeDefined();
      expect(row.organization_id).toBe(orgId);
    });

    it('rejects a PEM containing a private key with 400 PRIVATE_KEY_REJECTED', async () => {
      // A leaf cert with an appended private-key block. The schema requires a
      // CERTIFICATE block, and rejectPrivateKey() must veto before any storage.
      const keys = forge.pki.rsa.generateKeyPair({ bits: 1024 });
      const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
      const pem = `${generateLeafPem()}\n${keyPem}`;

      const res = await request(app)
        .post(`/api/v1/instances/${instanceId}/certificates`)
        .set('Authorization', `Bearer ${token}`)
        .send({ pem });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PRIVATE_KEY_REJECTED');
      // The rejected PEM must never be echoed back in the response.
      expect(JSON.stringify(res.body)).not.toContain('PRIVATE KEY');
    });

    it('rejects a body with no PEM certificate block with 400', async () => {
      const res = await request(app)
        .post(`/api/v1/instances/${instanceId}/certificates`)
        .set('Authorization', `Bearer ${token}`)
        .send({ pem: 'not a certificate' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/v1/instances/:id/certificates', () => {
    it('lists the certificates stored for the org', async () => {
      const res = await request(app)
        .get(`/api/v1/instances/${instanceId}/certificates`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // At least the one created by the POST suite above is present.
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.every((c: { organization_id: string }) => c.organization_id === orgId),
      ).toBe(true);
    });
  });

  describe('DELETE /api/v1/instances/:id/certificates/:cid', () => {
    it('removes an existing certificate', async () => {
      const pem = generateLeafPem();
      const created = await request(app)
        .post(`/api/v1/instances/${instanceId}/certificates`)
        .set('Authorization', `Bearer ${token}`)
        .send({ pem });
      const certId = created.body.data.id;

      const res = await request(app)
        .delete(`/api/v1/instances/${instanceId}/certificates/${certId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);

      const row = await db('certificates').where({ id: certId }).first();
      expect(row).toBeUndefined();
    });

    it('returns an error for an unknown certificate id', async () => {
      const res = await request(app)
        .delete(`/api/v1/instances/${instanceId}/certificates/${uuidv4()}`)
        .set('Authorization', `Bearer ${token}`);

      // The service throws CERTIFICATE_NOT_FOUND; asyncHandler surfaces a
      // non-success status with an error envelope rather than a 200.
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toBeDefined();
    });
  });
});
