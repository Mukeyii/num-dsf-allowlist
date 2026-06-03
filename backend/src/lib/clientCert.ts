/**
 * clientCert.ts – Pure helpers for client-certificate authentication.
 * Used by the mTLS-protected /fhir routes AND the /auth/client-cert-login
 * endpoint, which both authenticate a caller via the same thumbprint match.
 */
import crypto from 'crypto';
import type { Request } from 'express';

export interface ClientCertInfo {
  thumbprint: string;
  pem: string;
}

/**
 * Extract a client certificate from request headers (set by nginx via
 * $ssl_client_escaped_cert) and compute its SHA-256 thumbprint. Returns
 * null when no usable cert is present.
 */
export function extractClientCert(req: Request): ClientCertInfo | null {
  const raw = (req.headers['x-client-cert'] ?? req.headers['x-ssl-client-cert']) as
    | string
    | undefined;
  if (!raw) return null;
  let pem: string;
  try {
    pem = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!pem.includes('BEGIN CERTIFICATE')) return null;
  const der = Buffer.from(
    pem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, ''),
    'base64',
  );
  if (der.length === 0) return null;
  const thumbprint = crypto.createHash('sha256').update(der).digest('hex');
  return { thumbprint, pem };
}
