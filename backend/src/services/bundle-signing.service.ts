/**
 * bundle-signing.service.ts – Sign FHIR Bundles with RS256 and hash content
 * Dependencies: jsonwebtoken, crypto
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_PRIVATE_KEY = Buffer.from(process.env.JWT_PRIVATE_KEY_BASE64 || '', 'base64').toString('utf8');

/**
 * Sign a bundle JSON and return { bundle, signature, contentHash }
 */
export function signBundle(bundle: object): { bundle: object; signature: string; contentHash: string } {
  const json = JSON.stringify(bundle);
  const contentHash = crypto.createHash('sha256').update(json).digest('hex');

  const signature = jwt.sign(
    { contentHash, timestamp: new Date().toISOString() },
    JWT_PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: '365d' } as any,
  );

  return { bundle, signature, contentHash };
}
