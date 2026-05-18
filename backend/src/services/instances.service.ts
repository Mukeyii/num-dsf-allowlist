/**
 * instances.service.ts — DSF instance CRUD: list, create, fetch, rename.
 *
 * Extracted from routes/instances.routes.ts so handlers stop running
 * inline Knex queries (CLAUDE.md: "DB access only via service layer").
 *
 * Dependencies: db/connection, audit.service, isAdmin, uuid
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { isAdminEmail } from '../lib/isAdmin';
import { v4 as uuidv4 } from 'uuid';

export interface InstanceRow {
  id: string;
  user_id: string;
  label: string;
  created_at: Date;
}

export interface EnrichedInstanceRow extends InstanceRow {
  // Display label preference: associated org's identifier (FQDN), falling
  // back to the stored label, falling back to the raw UUID.
  label: string;
  owner_email?: string | null;
}

/**
 * List instances visible to the caller.
 * Admins (per admin_grants table) see every instance cross-tenant;
 * regular users see only their own. The single-instance fetch
 * (`getInstance`) already respected admin bypass — this brings the list
 * endpoint in line with that contract.
 */
export async function listForUser(userId: string, callerEmail?: string): Promise<EnrichedInstanceRow[]> {
  const isAdmin = await isAdminEmail(callerEmail);
  const query = db<InstanceRow>('instances').orderBy('created_at', 'asc');
  if (!isAdmin) query.where({ user_id: userId });
  const instances = await query;

  // Single fetch of the orgs that belong to these instances — replaces an
  // N+1 (one org SELECT per instance) with a single whereIn + Map lookup.
  const ids = instances.map(i => i.id);
  const orgs = ids.length === 0
    ? []
    : await db('organizations').whereIn('instance_id', ids).select('instance_id', 'identifier');
  const orgByInstance = new Map<string, string>(
    orgs.map((o: { instance_id: string; identifier: string }) => [o.instance_id, o.identifier]),
  );

  return instances.map(inst => ({
    ...inst,
    label: orgByInstance.get(inst.id) || inst.label || inst.id,
  }));
}

export async function createInstance(
  userId: string,
  userEmail: string,
  ipAddress: string,
): Promise<InstanceRow> {
  const id = uuidv4();
  await db('instances').insert({ id, user_id: userId, label: id, created_at: new Date() });
  await writeAuditLog({
    userEmail,
    resourceType: 'AUTH',
    resourceId: id,
    operation: 'CREATE',
    ipAddress,
  });
  const instance = await db<InstanceRow>('instances').where({ id }).first();
  // The row we just inserted must exist; assert here so callers can rely
  // on a non-null return without a redundant null-check.
  if (!instance) throw new Error('INSTANCE_CREATE_FAILED');
  return instance;
}

/**
 * Fetch one instance. Admins bypass the user_id scope; non-admins only see
 * their own instances. Returns null if the row doesn't exist OR the caller
 * isn't entitled to read it (callers should respond 404 either way to
 * avoid leaking instance existence).
 */
export async function getInstance(
  id: string,
  callerEmail: string,
): Promise<EnrichedInstanceRow | null> {
  const isAdmin = await isAdminEmail(callerEmail);
  // We need the caller's user_id for the non-admin path. Look it up by email.
  const caller = await db('users').where({ email: callerEmail }).select('id').first();
  const q = db<InstanceRow>('instances').where({ id });
  if (!isAdmin) {
    if (!caller) return null;
    q.andWhere({ user_id: caller.id });
  }
  const instance = await q.first();
  if (!instance) return null;
  const owner = await db('users').where({ id: instance.user_id }).select('email').first();
  return { ...instance, owner_email: owner?.email ?? null };
}

/**
 * Rename an instance's label. Owner-only (admins can edit other fields on
 * a user's org/contacts/etc., but renaming someone's instance label is
 * intentionally locked to the owner). Returns null if the caller doesn't
 * own the instance — routes should respond 403.
 */
export async function renameInstance(
  id: string,
  userId: string,
  label: string,
): Promise<InstanceRow | null> {
  const instance = await db<InstanceRow>('instances').where({ id, user_id: userId }).first();
  if (!instance) return null;
  await db('instances').where({ id }).update({ label });
  return { ...instance, label };
}
