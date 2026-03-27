import { Request, Response, NextFunction } from 'express';

export function requireGeckoAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminEmails = (process.env.GECKO_ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!req.user?.email || !adminEmails.includes(req.user.email.toLowerCase())) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'GECKO admin access required' } });
    return;
  }
  next();
}
