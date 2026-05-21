/**
 * sync-mozilla-cas.test.ts
 * Unit tests for the PEM-parsing helpers in the Mozilla CA sync script.
 * Network fetch and DB insert are not exercised — those run in the actual
 * `npm run sync:cas` job.
 */
import forge from 'node-forge';
import { splitPems, fingerprintOf, subjectDnOf } from '../scripts/sync-mozilla-cas';

function generateTestCa(subjectAttrs: Array<{ shortName: string; value: string }>): string {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 1000 * 60 * 60 * 24);
  cert.setSubject(subjectAttrs);
  cert.setIssuer(subjectAttrs);
  cert.setExtensions([{ name: 'basicConstraints', cA: true }]);
  cert.sign(keys.privateKey);
  return forge.pki.certificateToPem(cert);
}

describe('Mozilla CA sync helpers', () => {
  it('splitPems splits a multi-cert bundle into individual PEMs', () => {
    const a = generateTestCa([{ shortName: 'CN', value: 'Test CA A' }]);
    const b = generateTestCa([{ shortName: 'CN', value: 'Test CA B' }]);
    const bundle = `# header line\n${a}\n# inter-cert comment\n${b}\n`;
    const out = splitPems(bundle);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatch(/-----BEGIN CERTIFICATE-----/);
    expect(out[0]).toMatch(/-----END CERTIFICATE-----$/);
  });

  it('splitPems drops anything that is not a complete PEM', () => {
    const incomplete = '-----BEGIN CERTIFICATE-----\nfoo\n'; // missing END
    const out = splitPems(incomplete);
    expect(out).toEqual([]);
  });

  it('fingerprintOf returns a 64-char upper-case hex string', () => {
    const ca = generateTestCa([{ shortName: 'CN', value: 'Fingerprint Test' }]);
    const fp = fingerprintOf(ca);
    expect(fp).toMatch(/^[0-9A-F]{64}$/);
  });

  it('fingerprintOf is deterministic for the same PEM', () => {
    const ca = generateTestCa([{ shortName: 'CN', value: 'Deterministic Test' }]);
    expect(fingerprintOf(ca)).toBe(fingerprintOf(ca));
  });

  it('subjectDnOf reconstructs CN=…,O=…,C=… from the subject', () => {
    const ca = generateTestCa([
      { shortName: 'CN', value: 'Test Root CA' },
      { shortName: 'O', value: 'Acme Trust Authority' },
      { shortName: 'C', value: 'DE' },
    ]);
    const dn = subjectDnOf(ca);
    expect(dn).toContain('CN=Test Root CA');
    expect(dn).toContain('O=Acme Trust Authority');
    expect(dn).toContain('C=DE');
  });
});
