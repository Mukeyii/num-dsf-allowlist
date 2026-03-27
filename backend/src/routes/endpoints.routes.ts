import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import * as svc from '../services/endpoints.service';

export const endpointsRouter = Router({ mergeParams: true });
endpointsRouter.use(requireAuth, requireInstanceOwnership);

endpointsRouter.get('/', async (req, res) => {
  res.json({ data: await svc.getEndpoints(req.instance!.id) });
});

endpointsRouter.post('/', async (req, res) => {
  try {
    const ep = await svc.createEndpoint(req.instance!.id, req.body, req.user!.email, req.ip || 'unknown');
    res.status(201).json({ data: ep });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

endpointsRouter.put('/:eid', async (req, res) => {
  try {
    const ep = await svc.updateEndpoint(req.instance!.id, req.params.eid, req.body, req.user!.email, req.ip || 'unknown');
    res.json({ data: ep });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});

endpointsRouter.delete('/:eid', async (req, res) => {
  try {
    await svc.deleteEndpoint(req.instance!.id, req.params.eid, req.user!.email, req.ip || 'unknown');
    res.json({ data: { deleted: true } });
  } catch (err: any) {
    res.status(400).json({ error: { code: err.message, message: err.message } });
  }
});
