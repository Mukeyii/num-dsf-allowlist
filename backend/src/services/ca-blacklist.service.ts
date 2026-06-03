/**
 * ca-blacklist.service.ts – Admin-managed CA blacklist + lookup used during
 * PEM upload (certificate.service.ts → createCertificate / renewCertificate).
 *
 * Match strategy: Subject DN equality (OR fingerprint, when the admin
 * uploaded the CA cert directly). DN-only match is intentional — operators
 * usually know the CA by name long before they have its PEM in hand.
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

export async function isCaBlacklisted(args: {
  subjectDn?: string;
  fingerprint?: string;
}): Promise<boolean> {
  if (!args.subjectDn && !args.fingerprint) return false;
  const q = db('ca_blacklist');
  q.where(function () {
    if (args.subjectDn) this.orWhere({ subject_dn: args.subjectDn });
    if (args.fingerprint) this.orWhere({ fingerprint: args.fingerprint.toUpperCase() });
  });
  const row = await q.first();
  return !!row;
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
