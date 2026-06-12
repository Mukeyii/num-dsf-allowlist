/**
 * isAdmin.ts – DB-backed admin role check with cryptographic signature
 * verification. Delegates to lib/adminGrants; ignores IMI_ADMIN_EMAILS at
 * runtime (used only for first-run bootstrap by admin-bootstrap.service).
 */
import { isVerifiedAdminEmail } from './adminGrants';

export async function isAdminEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  return isVerifiedAdminEmail(email);
}
