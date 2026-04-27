/**
 * auth-client-cert.test.ts – Contract tests for POST /auth/client-cert-login.
 * - 401 with no cert header
 * - 401 with cert whose thumbprint matches no org
 * - 200 with a cert whose thumbprint matches a seeded org (and access token returned)
 */
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import { db } from '../db/connection';
import { authRouter } from '../routes/auth.routes';
import { v4 as uuidv4 } from 'uuid';

const SAMPLE_PEM = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJALRiMLAh2wLSMA0GCSqGSIb3DQEBCwUAMBExDzANBgNVBAMMBnRl
c3RjYTAeFw0yNTAxMDEwMDAwMDBaFw0yNjAxMDEwMDAwMDBaMBExDzANBgNVBAMM
BnRlc3RjYTBcMA0GCSqGSIb3DQEBAQUAA0sAMEgCQQC7o96HtiMR+dqpMgLzOPSx
5IAoMpOZzFMqxA7E5JN9GK5FdJoG9brkCaJMnoYhbyXjxyoGS2YqvECRnpc1bN0z
AgMBAAEwDQYJKoZIhvcNAQELBQADQQBY7lY1eByq0TA6M2qHTHmao+mSjHR8hEIq
b7dUjzKHYESSYsXoPNMiPiX85ysSGrFcdPt4MfrDXJe9Zk/3RmeO
-----END CERTIFICATE-----`;

const OTHER_PEM = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJALRiMLAh2wLSMA0GCSqGSIb3DQEBCwUAMBExDzANBgNVBAMMBnRl
c3RjYTAeFw0yNTAxMDEwMDAwMDBaFw0yNjAxMDEwMDAwMDBaMBExDzANBgNVBAMM
BnRlc3RjYTBcMA0GCSqGSIb3DQEBAQUAA0sAMEgCQQC7o96HtiMR+dqpMgLzOPSx
5IAoMpOZzFMqxA7E5JN9GK5FdJoG9brkCaJMnoYhbyXjxyoGS2YqvECRnpc1bN0z
AgMBAAEwDQYJKoZIhvcNAQELBQADQQBY7lY1eByq0TA6M2qHTHmao+mSjHR8hEIq
b7dUjzKHYESSYsXoPNMiPiX85ysSGrFcdPt4MfrDXJe9Zk/3RmeAAAAAA
-----END CERTIFICATE-----`;

function thumbprintOf(pem: string): string {
  const der = Buffer.from(
    pem.replace(/-----BEGIN CERTIFICATE-----/g, '')
       .replace(/-----END CERTIFICATE-----/g, '')
       .replace(/\s+/g, ''),
    'base64',
  );
  return crypto.createHash('sha256').update(der).digest('hex');
}

function appWith() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  return app;
}

describe('POST /auth/client-cert-login', () => {
  const userId = uuidv4();
  const instanceId = uuidv4();
  const orgIdentifier = 'cert-login-test.example.de';
  const tp = thumbprintOf(SAMPLE_PEM);

  beforeAll(async () => {
    await db('users').insert({ id: userId, email: 'cert-user@example.de', created_at: new Date() });
    await db('instances').insert({ id: instanceId, user_id: userId, label: 'L', created_at: new Date() });
    await db('organizations').insert({
      identifier: orgIdentifier, instance_id: instanceId,
      name: 'CertLogin', email: 'a@b.de', active: true,
      client_cert_thumbprint: tp,
      created_at: new Date(), updated_at: new Date(),
    });
  });

  afterAll(async () => {
    await db('organizations').where({ identifier: orgIdentifier }).del();
    await db('instances').where({ id: instanceId }).del();
    await db('users').where({ id: userId }).del();
  });

  it('401 without cert header', async () => {
    const res = await request(appWith()).post('/auth/client-cert-login');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_CLIENT_CERT');
  });

  it('401 when thumbprint does not match any org', async () => {
    const res = await request(appWith())
      .post('/auth/client-cert-login')
      .set('x-client-cert', encodeURIComponent(OTHER_PEM));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('CERT_NOT_REGISTERED');
  });

  it('200 when thumbprint matches a registered org', async () => {
    const res = await request(appWith())
      .post('/auth/client-cert-login')
      .set('x-client-cert', encodeURIComponent(SAMPLE_PEM));
    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.email).toBe('cert-user@example.de');
  });
});
