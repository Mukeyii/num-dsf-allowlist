/**
 * certificate.service.db.test.ts – DB-backed CRUD tests for certificate.service.
 * Covers the storage path: createCertificate (persists subject/thumbprint/
 * valid_until matching parseCertificate, rejects private keys and missing org),
 * getCertificates (lists the org's certs newest-first), deleteCertificate
 * (removes one + NOT_FOUND guards), and renewCertificate (swaps in a new cert
 * inside a transaction). parseCertificate/rejectPrivateKey are covered elsewhere.
 *
 * A valid leaf cert is generated in-process with node-forge so no PEM fixture
 * (or any literal private-key block) lives in the repo. The seeded org uses a
 * unique identifier so parallel suites never collide.
 *
 * Dependencies: db/connection, certificate.service, parseCertificate (oracle).
 */
import forge from 'node-forge';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import {
  createCertificate,
  getCertificates,
  deleteCertificate,
  renewCertificate,
  parseCertificate,
} from '../services/certificate.service';

const SUFFIX = `${Date.now()}-${uuidv4().slice(0, 8)}`;
const userId = uuidv4();
const instanceId = uuidv4();
const orgIdentifier = `cert-db-${SUFFIX}.example.de`;
const userEmail = `cert-db-${SUFFIX}@example.de`;
const ip = '127.0.0.1';

/**
 * Build a self-signed leaf certificate PEM. The keypair is created only to sign
 * the cert in-process; the private key is never stored or returned — only the
 * public certificate PEM leaves this function. A unique issuer O keeps the
 * issuer DN off any shared CA blacklist.
 */
function generateLeafPem(cn: string): string {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '0A';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90);
  const attrs = [
    { shortName: 'CN', value: cn },
    { shortName: 'O', value: `CertDbTest-${SUFFIX}` },
    { shortName: 'C', value: 'DE' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  return forge.pki.certificateToPem(cert);
}

describe('certificate.service – DB CRUD', () => {
  beforeAll(async () => {
    await db('users').insert({
      id: userId,
      email: userEmail,
      totp_enabled: false,
      created_at: new Date(),
    });
    await db('instances').insert({
      id: instanceId,
      user_id: userId,
      label: 'cert-db-test',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: orgIdentifier,
      instance_id: instanceId,
      name: 'Cert DB Test',
      active: true,
      email: `admin@${orgIdentifier}`,
      address_line: 'x',
      postal_code: '00000',
      city: 'x',
      country_code: 'DE',
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  afterAll(async () => {
    try {
      await db('audit_logs').where({ instance_id: instanceId }).del();
      await db('certificates').where({ organization_id: orgIdentifier }).del();
    } finally {
      await db('organizations').where({ identifier: orgIdentifier }).del();
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });

  it('createCertificate stores the parsed subject, thumbprint and valid_until', async () => {
    const pem = generateLeafPem(`leaf-create.${orgIdentifier}`);
    const expected = parseCertificate(pem);

    const created = await createCertificate(instanceId, pem, userEmail, ip);
    expect(created).toBeTruthy();
    expect(created.organization_id).toBe(orgIdentifier);
    expect(created.subject).toBe(expected.subject);
    expect(created.thumbprint).toBe(expected.thumbprint);

    // Row is actually persisted with the same values.
    const row = await db('certificates').where({ id: created.id }).first();
    expect(row).toBeTruthy();
    expect(row.subject).toBe(expected.subject);
    expect(row.thumbprint).toBe(expected.thumbprint);
    expect(new Date(row.valid_until).getUTCFullYear()).toBe(expected.validUntil.getUTCFullYear());

    await db('certificates').where({ id: created.id }).del();
  });

  it('createCertificate rejects a PEM that carries a private-key block', async () => {
    // Short non-PEM marker — exercises rejectPrivateKey without an inert key blob.
    const marker = ['-----BEGIN', 'RSA', 'PRIVATE', 'KEY-----'].join(' ');
    await expect(createCertificate(instanceId, marker, userEmail, ip)).rejects.toThrow(
      'PRIVATE_KEY_REJECTED',
    );
  });

  it('createCertificate throws ORGANIZATION_NOT_FOUND when the instance has no org', async () => {
    const pem = generateLeafPem(`leaf-noorg.${orgIdentifier}`);
    await expect(createCertificate(uuidv4(), pem, userEmail, ip)).rejects.toThrow(
      'ORGANIZATION_NOT_FOUND',
    );
  });

  it('getCertificates lists the org certs sorted by created_at descending', async () => {
    const a = await createCertificate(
      instanceId,
      generateLeafPem(`leaf-a.${orgIdentifier}`),
      userEmail,
      ip,
    );
    const b = await createCertificate(
      instanceId,
      generateLeafPem(`leaf-b.${orgIdentifier}`),
      userEmail,
      ip,
    );

    const listed = await getCertificates(instanceId);
    const ids = listed.map((r: { id: string }) => r.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);

    // Every row belongs to this org and the list is non-increasing in created_at.
    // (created_at granularity can tie two same-second inserts, so this asserts
    // the descending contract rather than a strict insert-order between ties.)
    expect(
      listed.every((r: { organization_id: string }) => r.organization_id === orgIdentifier),
    ).toBe(true);
    const times = listed.map((r: { created_at: string | Date }) =>
      new Date(r.created_at).getTime(),
    );
    const sorted = [...times].sort((x, y) => y - x);
    expect(times).toEqual(sorted);

    await db('certificates').whereIn('id', [a.id, b.id]).del();
  });

  it('getCertificates returns [] for an instance without an organization', async () => {
    const listed = await getCertificates(uuidv4());
    expect(listed).toEqual([]);
  });

  it('deleteCertificate removes the row', async () => {
    const created = await createCertificate(
      instanceId,
      generateLeafPem(`leaf-del.${orgIdentifier}`),
      userEmail,
      ip,
    );
    await deleteCertificate(instanceId, created.id, userEmail, ip);
    const row = await db('certificates').where({ id: created.id }).first();
    expect(row).toBeUndefined();
  });

  it('deleteCertificate throws CERTIFICATE_NOT_FOUND for an unknown cert id', async () => {
    await expect(deleteCertificate(instanceId, uuidv4(), userEmail, ip)).rejects.toThrow(
      'CERTIFICATE_NOT_FOUND',
    );
  });

  it('renewCertificate inserts the new cert and deletes the old one', async () => {
    const oldCert = await createCertificate(
      instanceId,
      generateLeafPem(`leaf-old.${orgIdentifier}`),
      userEmail,
      ip,
    );
    const newPem = generateLeafPem(`leaf-new.${orgIdentifier}`);
    const expectedNew = parseCertificate(newPem);

    const renewed = await renewCertificate(instanceId, oldCert.id, { pem: newPem }, userEmail, ip);

    expect(renewed).toBeTruthy();
    expect(renewed.id).not.toBe(oldCert.id);
    expect(renewed.subject).toBe(expectedNew.subject);
    expect(renewed.thumbprint).toBe(expectedNew.thumbprint);

    // Old gone, new present.
    expect(await db('certificates').where({ id: oldCert.id }).first()).toBeUndefined();
    expect(await db('certificates').where({ id: renewed.id }).first()).toBeTruthy();

    await db('certificates').where({ id: renewed.id }).del();
  });

  it('renewCertificate throws CERTIFICATE_NOT_FOUND for an unknown old cert id', async () => {
    const pem = generateLeafPem(`leaf-renew-missing.${orgIdentifier}`);
    await expect(renewCertificate(instanceId, uuidv4(), { pem }, userEmail, ip)).rejects.toThrow(
      'CERTIFICATE_NOT_FOUND',
    );
  });
});
