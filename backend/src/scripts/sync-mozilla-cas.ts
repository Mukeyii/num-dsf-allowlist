/**
 * sync-mozilla-cas.ts – Pull the curl/Mozilla CA bundle (PEM list) and upsert
 * (fingerprint, subject_dn) into known_cas. Idempotent; safe to run daily.
 *
 * Source: https://curl.se/ca/cacert.pem  (Mozilla-derived, refreshed by the
 *         curl maintainers from CCADB. CDN-cached, signed, well-maintained.)
 *
 * Usage:  npm run sync:cas    (from backend/)
 */
import 'dotenv/config';
import forge from 'node-forge';
import crypto from 'crypto';
import { db } from '../db/connection';
import { logger } from '../lib/logger';

const URL = process.env.MOZILLA_CA_URL || 'https://curl.se/ca/cacert.pem';

export function splitPems(bundle: string): string[] {
  const parts = bundle.split(/(?=-----BEGIN CERTIFICATE-----)/g);
  return parts
    .map(p => p.trim())
    .filter(p => p.startsWith('-----BEGIN CERTIFICATE-----') && p.endsWith('-----END CERTIFICATE-----'));
}

export function fingerprintOf(pem: string): string {
  const cert = forge.pki.certificateFromPem(pem);
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  return crypto.createHash('sha256').update(Buffer.from(der, 'binary')).digest('hex').toUpperCase();
}

export function subjectDnOf(pem: string): string {
  const cert = forge.pki.certificateFromPem(pem);
  return cert.subject.attributes
    .map((a: forge.pki.CertificateField) => {
      const key = a.shortName || a.name || 'UNKNOWN';
      const val = typeof a.value === 'string' ? a.value : String(a.value ?? '');
      return `${key}=${val}`;
    })
    .join(',');
}

export async function syncOnce(text: string): Promise<{ upserted: number; skipped: number }> {
  const pems = splitPems(text);
  let upserted = 0;
  let skipped = 0;
  for (const pem of pems) {
    try {
      const fingerprint = fingerprintOf(pem);
      const subject_dn = subjectDnOf(pem);
      await db('known_cas')
        .insert({ fingerprint, subject_dn, source: 'mozilla', synced_at: new Date() })
        .onConflict('fingerprint').merge({ subject_dn, synced_at: new Date() });
      upserted++;
    } catch (e) {
      skipped++;
      logger.warn({ err: e instanceof Error ? e.message : 'unknown' }, 'skipped malformed CA PEM');
    }
  }
  return { upserted, skipped };
}

async function main() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${URL}`);
  const text = await res.text();
  const stats = await syncOnce(text);
  logger.info(stats, 'known_cas sync complete');
  await db.destroy();
}

// Run when invoked directly, skip when imported (e.g. by tests).
if (require.main === module) {
  main().catch((err) => {
    logger.fatal({ err: err instanceof Error ? err.message : 'unknown' }, 'sync-mozilla-cas failed');
    process.exit(1);
  });
}
