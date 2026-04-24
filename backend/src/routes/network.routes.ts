/**
 * network.routes.ts – Cross-instance allow-list map view for all authenticated users
 * Mounted at /api/v1/network
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getNetworkMap } from '../services/network.service';

export const networkRouter = Router();

networkRouter.get('/map', requireAuth, async (_req, res) => {
  const data = await getNetworkMap();
  res.json({ data });
});
