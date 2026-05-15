/**
 * admin.middleware.ts – requireImiAdmin guard
 * Dependencies: isAdmin (DB-backed admin_grants table, RS256 signed)
 *
 * Use AFTER requireAuth — relies on req.user being set.
 * IMI_ADMIN_EMAILS env var is NOT consulted; admin status is read from
 * the admin_grants table with signature verification (migration 006).
 */
import { Request, Response, NextFunction } from 'express';
import { isAdminEmail } from '../lib/isAdmin';

export async function requireImiAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!(await isAdminEmail(req.user?.email))) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'IMI admin access required' } });
    return;
  }
  next();
}
