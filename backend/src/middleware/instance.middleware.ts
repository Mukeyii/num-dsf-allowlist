/**
 * instance.middleware.ts – Checks if the requested instance belongs to the logged-in user.
 * Must be mounted after requireAuth.
 * Injects req.instance into the request.
 */
import { Request, Response, NextFunction } from 'express';
import { db } from '../db/connection';

declare global {
  namespace Express {
    interface Request {
      instance?: { id: string; userId: string; label: string };
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

  const instance = await db('instances')
    .where({ id: instanceId, user_id: req.user!.id })
    .first();

  if (!instance) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Instance not found or access denied' } });
    return;
  }

  req.instance = instance;
  next();
}
