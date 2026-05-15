/**
 * bundle-signing.service.ts – Sign FHIR Bundles with RS256 and hash content
 * Dependencies: jsonwebtoken, crypto
 *
 * The signature is a JWT with a 'kid' header derived from the public key
 * fingerprint, so consumers can map signature → key and we can rotate
 * keys without breaking previously issued bundles (consumer keeps the
 * old kid pinned until they pull a fresh /.well-known/jwks.json).
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_PRIVATE_KEY = Buffer.from(process.env.JWT_PRIVATE_KEY_BASE64 || '', 'base64').toString('utf8');
const JWT_PUBLIC_KEY = Buffer.from(process.env.JWT_PUBLIC_KEY_BASE64 || '', 'base64').toString('utf8');

// Derive a stable kid from the public key: first 16 hex chars of its
// SHA-256 fingerprint. Same algorithm on the verifier side maps kid → key.
const KEY_ID = JWT_PUBLIC_KEY
  ? crypto.createHash('sha256').update(JWT_PUBLIC_KEY).digest('hex').slice(0, 16)
  : 'unknown';

/**
 * Sign a bundle JSON and return { bundle, signature, contentHash }
 */
export function signBundle(bundle: object): { bundle: object; signature: string; contentHash: string } {
  const json = JSON.stringify(bundle);
  const contentHash = crypto.createHash('sha256').update(json).digest('hex');

  const signature = jwt.sign(
    { contentHash, timestamp: new Date().toISOString() },
    JWT_PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: '365d', keyid: KEY_ID } as any,
  );

  return { bundle, signature, contentHash };
}
