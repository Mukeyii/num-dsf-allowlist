/**
 * isAdmin.ts – DB-backed admin role check with cryptographic signature
 * verification. Reads from admin_grants table; ignores IMI_ADMIN_EMAILS at
 * runtime (used only for first-run bootstrap by admin-bootstrap.service).
 */
import { db } from '../db/connection';
import { verifyGrant } from './adminGrants';

export async function isAdminEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const grant = await db('admin_grants').where({ email: email.toLowerCase() }).first();
  if (!grant) return false;
  return verifyGrant(grant);
}
