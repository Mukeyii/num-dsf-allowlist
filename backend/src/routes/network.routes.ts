/**
 * network.routes.ts – Cross-instance allow-list map view for all authenticated users
 * Mounted at /api/v1/network
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getNetworkMap } from '../services/network.service';
import { isAdminEmail } from '../lib/isAdmin';
import { asyncHandler } from '../lib/asyncHandler';

export const networkRouter = Router();

networkRouter.get(
  '/map',
  requireAuth,
  asyncHandler(async (req, res) => {
    const isAdmin = await isAdminEmail(req.user!.email);
    const data = await getNetworkMap({ isAdmin });
    res.json({ data, meta: { isAdmin } });
  }),
);
