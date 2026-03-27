import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import * as svc from '../services/memberships.service';

export const membershipsRouter = Router({ mergeParams: true });
membershipsRouter.use(requireAuth, requireInstanceOwnership);

membershipsRouter.get('/', async (req, res) => {
  res.json({ data: await svc.getMemberships(req.instance!.id) });
});

membershipsRouter.post('/', async (req, res) => {
  try {
    const ms = await svc.createMembership(req.instance!.id, req.body, req.user!.email, req.ip || 'unknown');
    res.status(201).json({ data: ms });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

membershipsRouter.put('/:mid', async (req, res) => {
  try {
    const ms = await svc.updateMembership(req.instance!.id, req.params.mid, req.body, req.user!.email, req.ip || 'unknown');
    res.json({ data: ms });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

membershipsRouter.delete('/:mid', async (req, res) => {
  try {
    await svc.deleteMembership(req.instance!.id, req.params.mid, req.user!.email, req.ip || 'unknown');
    res.json({ data: { deleted: true } });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});
