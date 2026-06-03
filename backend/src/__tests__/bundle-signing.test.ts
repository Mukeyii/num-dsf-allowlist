/**
 * bundle-signing.test.ts — signBundle must produce an RS256 JWT that the
 * matching public key can verify, with header.kid = first 16 hex chars of
 * sha256(public-key-PEM). This is the contract downstream BPE consumers
 * rely on for offline signature verification.
 *
 * Dependencies: bundle-signing.service, jsonwebtoken, crypto.
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// signBundle reads JWT_PRIVATE_KEY_BASE64 at module-load time. Without it the
// service throws on every call. Local devs without the env var get a clean
// skip; CI sets the keys explicitly (ci.yml backend-test job) so the suite
// always runs there.
const hasKeys = !!process.env.JWT_PRIVATE_KEY_BASE64 && !!process.env.JWT_PUBLIC_KEY_BASE64;
const d = hasKeys ? describe : describe.skip;

d('signBundle', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { signBundle } = require('../services/bundle-signing.service');
  const pub = Buffer.from(process.env.JWT_PUBLIC_KEY_BASE64 || '', 'base64').toString('utf8');

  it('produces an RS256 JWT that verifies against the configured public key', () => {
    const bundle = { resourceType: 'Bundle', entry: [] };
    const { signature, contentHash } = signBundle(bundle);
    const decoded = jwt.verify(signature, pub, { algorithms: ['RS256'] }) as {
      contentHash: string;
    };
    expect(decoded.contentHash).toBe(contentHash);
  });

  it('contentHash matches sha256(JSON.stringify(bundle))', () => {
    const bundle = { resourceType: 'Bundle', entry: [{ id: '1' }] };
    const { contentHash } = signBundle(bundle);
    const expected = crypto.createHash('sha256').update(JSON.stringify(bundle)).digest('hex');
    expect(contentHash).toBe(expected);
  });

  it('JWT header.kid equals first 16 hex of sha256(pubkey)', () => {
    const { signature } = signBundle({ resourceType: 'Bundle' });
    const header = JSON.parse(Buffer.from(signature.split('.')[0], 'base64url').toString('utf8'));
    const expectedKid = crypto.createHash('sha256').update(pub).digest('hex').slice(0, 16);
    expect(header.kid).toBe(expectedKid);
  });

  it('a tampered bundle would not match the signed contentHash', () => {
    const original = { resourceType: 'Bundle', entry: [{ id: 'a' }] };
    const { signature } = signBundle(original);
    const tampered = { resourceType: 'Bundle', entry: [{ id: 'b' }] };
    const tamperedHash = crypto.createHash('sha256').update(JSON.stringify(tampered)).digest('hex');
    const decoded = jwt.verify(signature, pub, { algorithms: ['RS256'] }) as {
      contentHash: string;
    };
    expect(decoded.contentHash).not.toBe(tamperedHash);
  });
});
