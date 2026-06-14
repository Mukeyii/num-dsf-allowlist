/**
 * ca-blacklist.service.ts – Admin-managed CA blacklist + lookup used during
 * PEM upload (certificate.service.ts → createCertificate / renewCertificate).
 *
 * Match strategy: normalized Subject DN equality (OR exact fingerprint, when
 * the admin uploaded the CA cert directly). DN-only match is intentional —
 * operators usually know the CA by name long before they have its PEM in hand.
 *
 * Storage: ca_blacklist (admin-managed deny-list), known_cas (Mozilla cache
 * for the picker UI). See migration 016.
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { writeAuditLog } from './audit.service';

export interface CaBlacklistRow {
  id: string;
  subject_dn: string;
  fingerprint: string | null;
  reason: string | null;
  added_by: string;
  added_at: Date;
}

export interface KnownCaRow {
  fingerprint: string;
  subject_dn: string;
  source: string;
  synced_at: Date;
}

// Normalize a DN for tolerant comparison: split on commas, trim + lowercase
// each RDN, drop empties, sort. This makes the deny-list robust to the cosmetic
// differences between an admin-typed DN and node-forge's rendered issuer DN
// (surrounding spaces, attribute ordering, letter case) that would otherwise
// silently bypass the blacklist. Fingerprint matching stays exact (it's a hash).
export function normalizeDn(dn: string): string {
  return dn
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(',');
}

export async function isCaBlacklisted(args: {
  subjectDn?: string;
  fingerprint?: string;
}): Promise<boolean> {
  if (!args.subjectDn && !args.fingerprint) return false;
  if (args.fingerprint) {
    const hit = await db('ca_blacklist')
      .where({ fingerprint: args.fingerprint.toUpperCase() })
      .first();
    if (hit) return true;
  }
  if (args.subjectDn) {
    const target = normalizeDn(args.subjectDn);
    const rows = await db('ca_blacklist').select('subject_dn');
    if (rows.some((r: { subject_dn: string }) => normalizeDn(r.subject_dn) === target)) return true;
  }
  return false;
}

export async function listBlacklist(): Promise<CaBlacklistRow[]> {
  return db<CaBlacklistRow>('ca_blacklist').orderBy('added_at', 'desc');
}

export async function addToBlacklist(
  entry: { subjectDn: string; fingerprint?: string; reason?: string },
  addedBy: string,
): Promise<string> {
  const id = uuidv4();
  await db('ca_blacklist').insert({
    id,
    subject_dn: entry.subjectDn,
    fingerprint: entry.fingerprint ? entry.fingerprint.toUpperCase() : null,
    reason: entry.reason ?? null,
    added_by: addedBy,
    added_at: new Date(),
  });
  await writeAuditLog({
    userEmail: addedBy,
    resourceType: 'CERTIFICATE',
    resourceId: id,
    operation: 'CREATE',
    diffJson: { action: 'ca_blacklist_add', subjectDn: entry.subjectDn },
  });
  return id;
}

export async function removeFromBlacklist(id: string, removedBy: string): Promise<void> {
  const row = await db('ca_blacklist').where({ id }).first();
  if (!row) throw new Error('NOT_FOUND');
  await db('ca_blacklist').where({ id }).del();
  await writeAuditLog({
    userEmail: removedBy,
    resourceType: 'CERTIFICATE',
    resourceId: id,
    operation: 'DELETE',
    diffJson: { action: 'ca_blacklist_remove', subjectDn: row.subject_dn },
  });
}

export async function listKnownCas(): Promise<KnownCaRow[]> {
  return db<KnownCaRow>('known_cas').orderBy('subject_dn', 'asc').limit(500);
}
