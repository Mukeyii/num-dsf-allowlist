import { Request, Response, NextFunction } from 'express';

export function requireImiAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminEmails = (process.env.IMI_ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!req.user?.email || !adminEmails.includes(req.user.email.toLowerCase())) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'IMI admin access required' } });
    return;
  }
  next();
}
