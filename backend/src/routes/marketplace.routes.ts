/**
 * marketplace.routes.ts – Read-only marketplace endpoints (auth required).
 * Dependencies: auth.middleware, marketplace.service
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { listEntries } from '../services/marketplace.service';

export const marketplaceRouter = Router();
marketplaceRouter.use(requireAuth);

marketplaceRouter.get('/', async (_req, res) => {
  const data = await listEntries();
  res.json({ data });
});
