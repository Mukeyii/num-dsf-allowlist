/**
 * adminGrants.ts – RS256 sign/verify helpers for admin_grants rows.
 * Private key from ADMIN_GRANT_PRIVATE_KEY_BASE64 (or fallback to JWT private key).
 * Public key from ADMIN_GRANT_PUBLIC_KEY_BASE64 (or fallback to JWT public key).
 */
import crypto from 'crypto';

function decodeBase64Pem(envName: string, fallbackEnvName: string): string {
  const b64 = process.env[envName] ?? process.env[fallbackEnvName];
  if (!b64) throw new Error(`${envName} or ${fallbackEnvName} required`);
  return Buffer.from(b64, 'base64').toString('utf8');
}

const PRIVATE_KEY_PEM = decodeBase64Pem('ADMIN_GRANT_PRIVATE_KEY_BASE64', 'JWT_PRIVATE_KEY_BASE64');
const PUBLIC_KEY_PEM = decodeBase64Pem('ADMIN_GRANT_PUBLIC_KEY_BASE64', 'JWT_PUBLIC_KEY_BASE64');

export interface AdminGrant {
  email: string;
  granted_at: Date | string;
  granted_by_a: string;
  granted_by_b: string;
  signature_hex: string;
}

export function canonicalMessage(
  email: string,
  grantedAt: Date | string,
  grantedByA: string,
  grantedByB: string,
): string {
  const iso =
    typeof grantedAt === 'string' ? new Date(grantedAt).toISOString() : grantedAt.toISOString();
  return `${email.toLowerCase()}|${iso}|${grantedByA.toLowerCase()}|${grantedByB.toLowerCase()}`;
}

export function signGrant(
  email: string,
  grantedAt: Date,
  grantedByA: string,
  grantedByB: string,
): string {
  const msg = canonicalMessage(email, grantedAt, grantedByA, grantedByB);
  const sig = crypto.sign('sha256', Buffer.from(msg, 'utf8'), PRIVATE_KEY_PEM);
  return sig.toString('hex');
}

export function verifyGrant(
  grant: Pick<
    AdminGrant,
    'email' | 'granted_at' | 'granted_by_a' | 'granted_by_b' | 'signature_hex'
  >,
): boolean {
  try {
    const msg = canonicalMessage(
      grant.email,
      grant.granted_at,
      grant.granted_by_a,
      grant.granted_by_b,
    );
    return crypto.verify(
      'sha256',
      Buffer.from(msg, 'utf8'),
      PUBLIC_KEY_PEM,
      Buffer.from(grant.signature_hex, 'hex'),
    );
  } catch {
    return false;
  }
}
