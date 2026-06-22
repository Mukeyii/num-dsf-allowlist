/**
 * fhir.routes.test.ts – Integration tests for the mTLS-protected /fhir routes.
 *
 * The /fhir endpoints authenticate machine-to-machine via client certificate
 * thumbprint (no JWT). nginx terminates mTLS and forwards the verified cert as
 * `X-Client-Cert` (URL-encoded PEM) plus `X-Client-Verify: SUCCESS`. The route
 * computes the SHA-256 thumbprint of the cert DER and looks up the org that
 * registered it via `client_cert_thumbprint`.
 *
 * Covers GET /fhir/Bundle/:endpointId:
 *  - 200 → resourceType 'Bundle' with the seeded Organization + Endpoint and
 *    the certificate thumbprint embedded as an extension
 *  - DSGVO: the serialized body never contains the seeded contact's PII
 *  - 401 with no client cert header
 *  - 401 when a cert is presented but X-Client-Verify is not SUCCESS
 *  - 403 when the cert thumbprint matches no registered org
 *  - 404 for an unknown endpoint id
 * and GET /fhir/Bundle (search):
 *  - 200 → resourceType 'Bundle'
 *
 * Each suite seeds its own rows with unique ids and tears them down, so
 * parallel jest workers never collide. The cert PEM is a static self-signed
 * CERTIFICATE block (no private-key material) so gitleaks stays clean.
 *
 * Dependencies: supertest, app, db/connection, crypto, uuid
 */
import request from 'supertest';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { app } from '../../app';
import { db } from '../../db/connection';

// Static self-signed cert (CERTIFICATE only — no private key). nginx would
// forward exactly this PEM URL-encoded in the X-Client-Cert header.
const SAMPLE_PEM = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJALRiMLAh2wLSMA0GCSqGSIb3DQEBCwUAMBExDzANBgNVBAMMBnRl
c3RjYTAeFw0yNTAxMDEwMDAwMDBaFw0yNjAxMDEwMDAwMDBaMBExDzANBgNVBAMM
BnRlc3RjYTBcMA0GCSqGSIb3DQEBAQUAA0sAMEgCQQC7o96HtiMR+dqpMgLzOPSx
5IAoMpOZzFMqxA7E5JN9GK5FdJoG9brkCaJMnoYhbyXjxyoGS2YqvECRnpc1bN0z
AgMBAAEwDQYJKoZIhvcNAQELBQADQQBY7lY1eByq0TA6M2qHTHmao+mSjHR8hEIq
b7dUjzKHYESSYsXoPNMiPiX85ysSGrFcdPt4MfrDXJe9Zk/3RmeO
-----END CERTIFICATE-----`;

// A different cert whose thumbprint matches no org → 403.
const UNREGISTERED_PEM = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJALRiMLAh2wLSMA0GCSqGSIb3DQEBCwUAMBExDzANBgNVBAMMBnRl
c3RjYTAeFw0yNTAxMDEwMDAwMDBaFw0yNjAxMDEwMDAwMDBaMBExDzANBgNVBAMM
BnRlc3RjYTBcMA0GCSqGSIb3DQEBAQUAA0sAMEgCQQC7o96HtiMR+dqpMgLzOPSx
5IAoMpOZzFMqxA7E5JN9GK5FdJoG9brkCaJMnoYhbyXjxyoGS2YqvECRnpc1bN0z
AgMBAAEwDQYJKoZIhvcNAQELBQADQQBY7lY1eByq0TA6M2qHTHmao+mSjHR8hEIq
b7dUjzKHYESSYsXoPNMiPiX85ysSGrFcdPt4MfrDXJe9Zk/3RmeAAAAAA
-----END CERTIFICATE-----`;

// Same DER thumbprint the route computes from the forwarded PEM.
function thumbprintOf(pem: string): string {
  const der = Buffer.from(
    pem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, ''),
    'base64',
  );
  return crypto.createHash('sha256').update(der).digest('hex');
}

interface BundleEntry {
  fullUrl?: string;
  resource?: {
    resourceType?: string;
    name?: string;
    address?: string;
    active?: boolean;
    identifier?: Array<{ system: string; value: string }>;
    extension?: Array<{ url: string; valueString: string }>;
  };
}
interface FhirBundle {
  resourceType: string;
  type?: string;
  entry?: BundleEntry[];
}

describe('GET /fhir routes (mTLS client-cert auth)', () => {
  const sfx = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const userId = uuidv4();
  const email = `route-fhir-${sfx}@example.de`;
  const instanceId = uuidv4();
  const orgId = `route-fhir-${sfx}.example.de`;
  const parentId = `verbund-${sfx}.example.de`;
  const endpointId = `dsf-fhir.${orgId}`;
  const certId = uuidv4();
  const membershipId = uuidv4();
  const contactId = uuidv4();
  const ipId = uuidv4();
  const approvalId = uuidv4();
  const thumbprint = thumbprintOf(SAMPLE_PEM);
  const certThumbprint = 'a'.repeat(64); // certificate row thumbprint (cert extension)

  // Recognizable PII that the DSGVO guarantee says must NOT reach the bundle.
  const contactEmail = `pii-leak-${sfx}@example.de`;
  const contactName = `Dr PiiLeak ${sfx}`;
  const contactPhone = `+4930${String(Date.now()).slice(-7)}`;

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
      label: 'fhir-route',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: orgId,
      instance_id: instanceId,
      name: 'FHIR Route Org',
      active: true,
      email: 'org@example.de',
      address_line: 'Org Street 1',
      postal_code: '48149',
      city: 'Muenster',
      country_code: 'DE',
      client_cert_thumbprint: thumbprint,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('endpoints').insert({
      identifier: endpointId,
      organization_id: orgId,
      name: 'Primary FHIR Endpoint',
      address: `https://${endpointId}/fhir`,
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('endpoint_ips').insert({
      id: ipId,
      endpoint_id: endpointId,
      ip: '10.20.30.40',
      is_fhir: true,
      is_bpe: false,
    });
    await db('certificates').insert({
      id: certId,
      organization_id: orgId,
      pem: 'CERT-MARKER',
      subject: `CN=${orgId}`,
      thumbprint: certThumbprint,
      valid_until: '2099-01-01',
      created_at: new Date(),
    });
    await db('memberships').insert({
      id: membershipId,
      organization_id: orgId,
      parent_organization: parentId,
      endpoint_id: endpointId,
      roles: JSON.stringify(['DIC', 'HRP']),
      created_at: new Date(),
      updated_at: new Date(),
    });
    // Contact under the same org — its PII must never reach the published bundle.
    await db('contacts').insert({
      id: contactId,
      organization_id: orgId,
      types: JSON.stringify(['DSF_ADMIN']),
      name: contactName,
      email: contactEmail,
      email_validated: true,
      phone: contactPhone,
      address_line: 'Secret Street 9',
      city: 'Muenster',
      postal_code: '48149',
      country_code: 'DE',
      created_at: new Date(),
      updated_at: new Date(),
    });
    // APPROVED so the org is part of the federation set for the search bundle.
    await db('approval_requests').insert({
      id: approvalId,
      instance_id: instanceId,
      status: 'APPROVED',
      created_at: new Date(),
      submitted_at: new Date(),
      resolved_at: new Date(),
      resolved_by: 'admin@example.de',
      snapshot_json: JSON.stringify({}),
    });
  });

  afterAll(async () => {
    try {
      await db('audit_logs').where({ instance_id: instanceId }).del();
      await db('approval_requests').where({ id: approvalId }).del();
      await db('contacts').where({ organization_id: orgId }).del();
      await db('memberships').where({ organization_id: orgId }).del();
      await db('certificates').where({ organization_id: orgId }).del();
      await db('endpoint_ips').where({ endpoint_id: endpointId }).del();
      await db('endpoints').where({ identifier: endpointId }).del();
    } finally {
      await db('organizations').where({ identifier: orgId }).del();
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
      await db('email_whitelist').where({ email }).del();
    }
  });

  describe('GET /fhir/Bundle/:endpointId', () => {
    it('returns 200 with a FHIR Bundle for a registered cert', async () => {
      const res = await request(app)
        .get(`/fhir/Bundle/${endpointId}`)
        .set('x-client-verify', 'SUCCESS')
        .set('x-client-cert', encodeURIComponent(SAMPLE_PEM));
      expect(res.status).toBe(200);
      const bundle = res.body as FhirBundle;
      expect(bundle.resourceType).toBe('Bundle');
      expect(bundle.type).toBe('transaction');
      expect(Array.isArray(bundle.entry)).toBe(true);
    });

    it('embeds the Organization and Endpoint with the expected identifiers', async () => {
      const res = await request(app)
        .get(`/fhir/Bundle/${endpointId}`)
        .set('x-client-verify', 'SUCCESS')
        .set('x-client-cert', encodeURIComponent(SAMPLE_PEM));
      const bundle = res.body as FhirBundle;
      const entries = bundle.entry ?? [];

      const orgEntry = entries.find(
        (e) =>
          e.resource?.resourceType === 'Organization' &&
          (e.resource.identifier ?? []).some((i) => i.value === orgId),
      );
      expect(orgEntry).toBeDefined();
      expect(orgEntry!.resource!.name).toBe('FHIR Route Org');
      expect(orgEntry!.resource!.active).toBe(true);

      const epEntry = entries.find(
        (e) =>
          e.resource?.resourceType === 'Endpoint' &&
          (e.resource.identifier ?? []).some((i) => i.value === endpointId),
      );
      expect(epEntry).toBeDefined();
      expect(epEntry!.resource!.address).toBe(`https://${endpointId}/fhir`);
    });

    it('embeds the certificate thumbprint as an Organization extension', async () => {
      const res = await request(app)
        .get(`/fhir/Bundle/${endpointId}`)
        .set('x-client-verify', 'SUCCESS')
        .set('x-client-cert', encodeURIComponent(SAMPLE_PEM));
      const bundle = res.body as FhirBundle;
      const orgEntry = (bundle.entry ?? []).find(
        (e) =>
          e.resource?.resourceType === 'Organization' &&
          (e.resource.identifier ?? []).some((i) => i.value === orgId),
      );
      const ext = orgEntry!.resource!.extension ?? [];
      expect(
        ext.some(
          (x) =>
            x.url === 'http://dsf.dev/fhir/StructureDefinition/extension-certificate-thumbprint' &&
            x.valueString === certThumbprint,
        ),
      ).toBe(true);
    });

    it('DSGVO: the serialized bundle never contains the contact PII', async () => {
      const res = await request(app)
        .get(`/fhir/Bundle/${endpointId}`)
        .set('x-client-verify', 'SUCCESS')
        .set('x-client-cert', encodeURIComponent(SAMPLE_PEM));
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain(contactEmail);
      expect(serialized).not.toContain(contactName);
      expect(serialized).not.toContain(contactPhone);
      expect(serialized).not.toContain('Secret Street 9');
      expect(serialized).not.toContain(contactId);
    });

    it('returns 401 (OperationOutcome) with no client cert header', async () => {
      const res = await request(app).get(`/fhir/Bundle/${endpointId}`);
      expect(res.status).toBe(401);
      expect(res.body.resourceType).toBe('OperationOutcome');
      expect(res.body.issue?.[0]?.code).toBe('security');
    });

    it('returns 401 when a cert is presented but mTLS verification did not succeed', async () => {
      const res = await request(app)
        .get(`/fhir/Bundle/${endpointId}`)
        .set('x-client-cert', encodeURIComponent(SAMPLE_PEM)); // no X-Client-Verify
      expect(res.status).toBe(401);
      expect(res.body.resourceType).toBe('OperationOutcome');
    });

    it('returns 403 when the cert thumbprint matches no registered org', async () => {
      const res = await request(app)
        .get(`/fhir/Bundle/${endpointId}`)
        .set('x-client-verify', 'SUCCESS')
        .set('x-client-cert', encodeURIComponent(UNREGISTERED_PEM));
      expect(res.status).toBe(403);
      expect(res.body.resourceType).toBe('OperationOutcome');
      expect(res.body.issue?.[0]?.code).toBe('forbidden');
    });

    it('returns 404 for an unknown endpoint id', async () => {
      const res = await request(app)
        .get('/fhir/Bundle/no-such-endpoint.example.de')
        .set('x-client-verify', 'SUCCESS')
        .set('x-client-cert', encodeURIComponent(SAMPLE_PEM));
      expect(res.status).toBe(404);
      expect(res.body.resourceType).toBe('OperationOutcome');
      expect(res.body.issue?.[0]?.code).toBe('not-found');
    });
  });

  describe('GET /fhir/Bundle (search by client cert)', () => {
    it('returns 200 with a FHIR Bundle for a registered cert', async () => {
      const res = await request(app)
        .get('/fhir/Bundle')
        .set('x-client-verify', 'SUCCESS')
        .set('x-client-cert', encodeURIComponent(SAMPLE_PEM));
      expect(res.status).toBe(200);
      const bundle = res.body as FhirBundle;
      expect(bundle.resourceType).toBe('Bundle');
      expect(Array.isArray(bundle.entry)).toBe(true);
    });

    it('returns 401 with no client cert header', async () => {
      const res = await request(app).get('/fhir/Bundle');
      expect(res.status).toBe(401);
      expect(res.body.resourceType).toBe('OperationOutcome');
    });

    it('returns 403 when the cert thumbprint matches no registered org', async () => {
      const res = await request(app)
        .get('/fhir/Bundle')
        .set('x-client-verify', 'SUCCESS')
        .set('x-client-cert', encodeURIComponent(UNREGISTERED_PEM));
      expect(res.status).toBe(403);
      expect(res.body.resourceType).toBe('OperationOutcome');
    });
  });
});
