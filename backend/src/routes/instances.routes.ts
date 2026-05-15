/**
 * instances.routes.ts – DSF Instance CRUD (list, create, show, rename)
 * Dependencies: auth.middleware, instances.service, asyncHandler, Zod
 *
 * All DB work lives in services/instances.service.ts — handlers stay
 * focused on request parsing + response shape.
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../lib/asyncHandler';
import * as svc from '../services/instances.service';

const labelSchema = z.object({
  label: z.string().trim().min(1, 'label required').max(255, 'label too long'),
});

export const instancesRouter = Router();
instancesRouter.use(requireAuth);

instancesRouter.get('/', asyncHandler(async (req, res) => {
  res.json({ data: await svc.listForUser(req.user!.id) });
}));

instancesRouter.post('/', asyncHandler(async (req, res) => {
  const instance = await svc.createInstance(req.user!.id, req.user!.email, req.ip || 'unknown');
  res.status(201).json({ data: instance });
}));

instancesRouter.get('/:id', asyncHandler(async (req, res) => {
  const instance = await svc.getInstance(req.params.id, req.user!.email);
  if (!instance) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Instance not found' } });
  res.json({ data: instance });
}));

instancesRouter.put('/:id/label', asyncHandler(async (req, res) => {
  const parsed = labelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION', message: parsed.error.errors[0]?.message || 'Invalid label' },
    });
  }
  const updated = await svc.renameInstance(req.params.id, req.user!.id, parsed.data.label);
  if (!updated) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
  res.json({ data: updated });
}));
