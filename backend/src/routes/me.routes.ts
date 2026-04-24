/**
 * me.routes.ts – Returns the authenticated user's identity and admin flag
 * Mounted at /auth/me
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { isAdminEmail } from '../lib/isAdmin';

export const meRouter = Router();

meRouter.get('/', requireAuth, (req, res) => {
  res.json({
    data: {
      email: req.user!.email,
      isAdmin: isAdminEmail(req.user!.email),
    },
  });
});
