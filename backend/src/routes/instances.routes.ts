/**
 * instances.routes.ts – Instance route placeholders
 * Will be fully implemented in Phase 3 (Entity-API)
 */
import { Router } from 'express';

export const instancesRouter = Router();

instancesRouter.get('/', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 3' } });
});

instancesRouter.post('/', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 3' } });
});

instancesRouter.get('/:id', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 3' } });
});
