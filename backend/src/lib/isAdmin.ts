/**
 * isAdmin.ts – Central check for IMI admin role
 * Reads IMI_ADMIN_EMAILS at call time (not at import) so tests can mutate env.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.IMI_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
