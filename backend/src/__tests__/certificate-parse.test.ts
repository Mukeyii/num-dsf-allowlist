/**
 * certificate-parse.test.ts — pure unit tests for parseCertificate. No DB.
 * Verifies the values the upload path depends on: the subject CN, a SHA-256
 * thumbprint (64 upper-case hex chars, deterministic for the same DER), the
 * notAfter expiry, and the issuer DN used by the CA-blacklist gate. Also
 * confirms a private key is rejected before parsing and a malformed PEM
 * surfaces as INVALID_PEM (never leaking node-forge internals).
 *
 * The cert is generated in-process with node-forge so the test needs no
 * binary fixture; the CA keypair only signs the leaf and is never stored.
 *
 * Dependencies: node-forge, certificate.service (pure functions).
 */
import forge from 'node-forge';
import { parseCertificate } from '../services/certificate.service';

const NOT_AFTER = new Date('2030-06-01T00:00:00Z');

function makeCert(opts: {
  subjectCn: string;
  issuerCn: string;
  issuerO: string;
  notAfter?: Date;
}): string {
  const caKeys = forge.pki.rsa.generateKeyPair({ bits: 1024 });
  const issuerAttrs = [
    { shortName: 'CN', value: opts.issuerCn },
    { shortName: 'O', value: opts.issuerO },
    { shortName: 'C', value: 'DE' },
  ];

  const leafKeys = forge.pki.rsa.generateKeyPair({ bits: 1024 });
  const leaf = forge.pki.createCertificate();
  leaf.publicKey = leafKeys.publicKey;
  leaf.serialNumber = '02';
  leaf.validity.notBefore = new Date('2020-01-01T00:00:00Z');
  leaf.validity.notAfter = opts.notAfter ?? NOT_AFTER;
  leaf.setSubject([{ shortName: 'CN', value: opts.subjectCn }]);
  leaf.setIssuer(issuerAttrs);
  leaf.sign(caKeys.privateKey);
  return forge.pki.certificateToPem(leaf);
}

describe('parseCertificate', () => {
  it('extracts the subject CN', () => {
    const pem = makeCert({ subjectCn: 'dsf-fhir.ukm.de', issuerCn: 'Test CA', issuerO: 'ACME' });
    expect(parseCertificate(pem).subject).toBe('dsf-fhir.ukm.de');
  });

  it('produces a 64-char upper-case hex SHA-256 thumbprint', () => {
    const pem = makeCert({ subjectCn: 'leaf.example.de', issuerCn: 'Test CA', issuerO: 'ACME' });
    const { thumbprint } = parseCertificate(pem);
    expect(thumbprint).toMatch(/^[0-9A-F]{64}$/);
  });

  it('computes the thumbprint deterministically for the same PEM', () => {
    const pem = makeCert({ subjectCn: 'leaf.example.de', issuerCn: 'Test CA', issuerO: 'ACME' });
    expect(parseCertificate(pem).thumbprint).toBe(parseCertificate(pem).thumbprint);
  });

  it('gives different thumbprints for different certs', () => {
    const a = makeCert({ subjectCn: 'a.example.de', issuerCn: 'Test CA', issuerO: 'ACME' });
    const b = makeCert({ subjectCn: 'b.example.de', issuerCn: 'Test CA', issuerO: 'ACME' });
    expect(parseCertificate(a).thumbprint).not.toBe(parseCertificate(b).thumbprint);
  });

  it('extracts the notAfter expiry date', () => {
    const notAfter = new Date('2028-12-31T00:00:00Z');
    const pem = makeCert({
      subjectCn: 'leaf.example.de',
      issuerCn: 'Test CA',
      issuerO: 'ACME',
      notAfter,
    });
    expect(parseCertificate(pem).validUntil.getTime()).toBe(notAfter.getTime());
  });

  it('extracts an issuer DN containing the issuer CN and O', () => {
    const pem = makeCert({
      subjectCn: 'leaf.example.de',
      issuerCn: 'Münster Root CA',
      issuerO: 'IMI',
    });
    const { issuerDn } = parseCertificate(pem);
    expect(issuerDn).toContain('CN=Münster Root CA');
    expect(issuerDn).toContain('O=IMI');
  });

  it('rejects a private key before attempting to parse', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----';
    expect(() => parseCertificate(pem)).toThrow('PRIVATE_KEY_REJECTED');
  });

  it('throws INVALID_PEM for a malformed certificate body', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nnot base64 der at all\n-----END CERTIFICATE-----';
    expect(() => parseCertificate(pem)).toThrow('INVALID_PEM');
  });

  it('throws INVALID_PEM for input with no PEM markers', () => {
    expect(() => parseCertificate('just some text')).toThrow('INVALID_PEM');
  });
});
