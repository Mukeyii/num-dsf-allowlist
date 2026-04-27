/**
 * instance.middleware.ts – Checks if the requested instance belongs to the
 * logged-in user. IMI admins bypass the ownership filter so they can review
 * and assist with any user's instance — the frontend surfaces a banner when
 * the loaded instance does not belong to the current admin user.
 *
 * Must be mounted after requireAuth.
 * Injects req.instance into the request.
 */
import { Request, Response, NextFunction } from 'express';
import { db } from '../db/connection';
import { isAdminEmail } from '../lib/isAdmin';

declare global {
  namespace Express {
    interface Request {
      instance?: { id: string; user_id: string; label: string };
    }
  }
}

export async function requireInstanceOwnership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const instanceId = req.params.instanceId || req.params.id;
  if (!instanceId) {
    res.status(400).json({ error: { code: 'MISSING_INSTANCE', message: 'Instance ID required' } });
    return;
  }

  const isAdmin = isAdminEmail(req.user?.email);
  const query = db('instances').where({ id: instanceId });
  if (!isAdmin) {
    query.andWhere({ user_id: req.user!.id });
  }
  const instance = await query.first();

  if (!instance) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Instance not found or access denied' } });
    return;
  }

  req.instance = instance;
  next();
}
