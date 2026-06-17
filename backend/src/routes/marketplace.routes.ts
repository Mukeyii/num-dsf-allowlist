/**
 * marketplace.routes.ts – Read-only marketplace endpoints (auth required).
 * Dependencies: auth.middleware, marketplace.service
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { listEntries, getEntryBySlug } from '../services/marketplace.service';

export const marketplaceRouter = Router();
marketplaceRouter.use(requireAuth);

marketplaceRouter.get('/', async (_req, res) => {
  const data = await listEntries();
  res.json({ data });
});

marketplaceRouter.get('/:slug', async (req, res) => {
  const entry = await getEntryBySlug(req.params.slug);
  if (!entry) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Process not found' } });
    return;
  }
  res.json({ data: entry });
});
