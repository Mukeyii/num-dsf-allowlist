/**
 * network.routes.ts – Cross-instance allow-list map view for all authenticated users
 * Mounted at /api/v1/network
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getNetworkMap } from '../services/network.service';
import { isAdminEmail } from '../lib/isAdmin';

export const networkRouter = Router();

networkRouter.get('/map', requireAuth, async (req, res) => {
  const isAdmin = isAdminEmail(req.user!.email);
  const data = await getNetworkMap({ isAdmin });
  res.json({ data, meta: { isAdmin } });
});
