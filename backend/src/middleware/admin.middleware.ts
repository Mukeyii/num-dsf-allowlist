import { Request, Response, NextFunction } from 'express';
import { isAdminEmail } from '../lib/isAdmin';

export async function requireImiAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!(await isAdminEmail(req.user?.email))) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'IMI admin access required' } });
    return;
  }
  next();
}
