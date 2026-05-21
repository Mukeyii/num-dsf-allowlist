/**
 * certificate-private-key-rejection.test.ts — the PEM upload path MUST reject
 * any private-key block (PKCS#8, PKCS#1, EC, DSA, OPENSSH, ENCRYPTED, plus
 * case-insensitive variants). The check is the only thing between a careless
 * paste and a private key landing in the DB.
 *
 * Dependencies: certificate.service (pure function).
 */
import { rejectPrivateKey } from '../services/certificate.service';

describe('rejectPrivateKey', () => {
  it.each([
    '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----',
    '-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----',
    '-----BEGIN EC PRIVATE KEY-----\nMIIE...\n-----END EC PRIVATE KEY-----',
    '-----BEGIN DSA PRIVATE KEY-----\nMIIE...\n-----END DSA PRIVATE KEY-----',
    '-----BEGIN OPENSSH PRIVATE KEY-----\nb3Bl...\n-----END OPENSSH PRIVATE KEY-----',
    '-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIF...\n-----END ENCRYPTED PRIVATE KEY-----',
    '-----begin private key-----\nMIIE...\n-----end private key-----',
    'leading text\n-----BEGIN RSA PRIVATE KEY-----\nblob\n-----END RSA PRIVATE KEY-----\ntrailing',
  ])('throws on %p', (pem) => {
    expect(() => rejectPrivateKey(pem)).toThrow();
  });

  it('accepts a pure certificate PEM', () => {
    const cert = '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----';
    expect(() => rejectPrivateKey(cert)).not.toThrow();
  });

  it('accepts an empty string (other validation rejects empties separately)', () => {
    expect(() => rejectPrivateKey('')).not.toThrow();
  });
});
