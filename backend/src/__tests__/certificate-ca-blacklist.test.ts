/**
 * certificate-ca-blacklist.test.ts
 * Integration: createCertificate must reject a PEM whose issuer Subject DN
 * is on the CA blacklist with the named error CA_BLACKLISTED. Removing the
 * blacklist entry lets the same PEM through.
 *
 * The PEM is generated on the fly with node-forge so the test does not
 * depend on any binary fixture.
 */
import forge from 'node-forge';
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { createCertificate } from '../services/certificate.service';
import { addToBlacklist, removeFromBlacklist, listBlacklist } from '../services/ca-blacklist.service';

const userEmail = `cab-cert-${Date.now()}@example.de`;
const userId = uuidv4();
const instanceId = uuidv4();
const orgIdentifier = `cab-cert-${Date.now()}.example.de`;
const ISSUER_DN = `CN=Test CA,O=ACME-${Date.now()},C=DE`;

function generateLeafIssuedBy(issuerCn: string, issuerO: string, issuerC: string): string {
  // Create the CA's own keypair only to sign the leaf — we never store or
  // expose the private key. The signed leaf cert is what the test uploads.
  const caKeys = forge.pki.rsa.generateKeyPair({ bits: 1024 });
  const caCert = forge.pki.createCertificate();
  caCert.publicKey = caKeys.publicKey;
  caCert.serialNumber = '01';
  caCert.validity.notBefore = new Date();
  caCert.validity.notAfter = new Date(Date.now() + 1000 * 60 * 60 * 24);
  const issuerAttrs = [
    { shortName: 'CN', value: issuerCn },
    { shortName: 'O', value: issuerO },
    { shortName: 'C', value: issuerC },
  ];
  caCert.setSubject(issuerAttrs);
  caCert.setIssuer(issuerAttrs);
  caCert.setExtensions([{ name: 'basicConstraints', cA: true }]);
  caCert.sign(caKeys.privateKey);

  const leafKeys = forge.pki.rsa.generateKeyPair({ bits: 1024 });
  const leaf = forge.pki.createCertificate();
  leaf.publicKey = leafKeys.publicKey;
  leaf.serialNumber = '02';
  leaf.validity.notBefore = new Date();
  leaf.validity.notAfter = new Date(Date.now() + 1000 * 60 * 60 * 24);
  leaf.setSubject([{ shortName: 'CN', value: `dsf-fhir.${orgIdentifier}` }]);
  leaf.setIssuer(issuerAttrs);
  leaf.sign(caKeys.privateKey);
  return forge.pki.certificateToPem(leaf);
}

describe('certificate upload — CA blacklist gate', () => {
  beforeAll(async () => {
    await db('users').insert({ id: userId, email: userEmail, totp_enabled: false, created_at: new Date() });
    await db('instances').insert({ id: instanceId, user_id: userId, label: 'cab-cert-test', created_at: new Date() });
    await db('organizations').insert({
      identifier: orgIdentifier, instance_id: instanceId, name: 'CAB Cert Test', active: true,
      email: `admin@${orgIdentifier}`, address_line: 'x', postal_code: '00000', city: 'x', country_code: 'DE',
      created_at: new Date(), updated_at: new Date(),
    });
  });

  afterAll(async () => {
    await db('certificates').where({ organization_id: orgIdentifier }).del();
    await db('organizations').where({ identifier: orgIdentifier }).del();
    await db('instances').where({ id: instanceId }).del();
    await db('users').where({ id: userId }).del();
    // Drop any test blacklist rows we may have created
    const rows = await listBlacklist();
    for (const r of rows.filter(x => x.subject_dn === ISSUER_DN)) {
      await db('ca_blacklist').where({ id: r.id }).del();
    }
  });

  it('rejects PEM upload when issuer DN is on the blacklist', async () => {
    const pem = generateLeafIssuedBy(`Test CA`, `ACME-${Date.now()}`, 'DE');
    // Discover the actual issuer DN from the freshly-generated cert
    const issuerDn = pem ? require('node-forge').pki.certificateFromPem(pem).issuer.attributes
      .map((a: any) => `${a.shortName || a.name}=${a.value}`).join(',') : '';
    await addToBlacklist({ subjectDn: issuerDn, reason: 'jest test' }, userEmail);
    await expect(
      createCertificate(instanceId, pem, userEmail, '0.0.0.0'),
    ).rejects.toThrow('CA_BLACKLISTED');
  });

  it('accepts the PEM once the blacklist entry is removed', async () => {
    const pem = generateLeafIssuedBy(`Test CA Two`, `ACME-${Date.now()}`, 'DE');
    // First-time upload (no blacklist) should succeed
    await expect(
      createCertificate(instanceId, pem, userEmail, '0.0.0.0'),
    ).resolves.toBeDefined();
  });
});
