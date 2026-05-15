/**
 * endpoints.routes.ts – DSF FHIR endpoint CRUD + IP list
 * Dependencies: auth/instance middleware, endpoint.service, endpoint schema, sanitizeError
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { validate } from '../middleware/validate.middleware';
import { createEndpointSchema, updateEndpointSchema } from '../schemas/endpoint.schema';
import * as svc from '../services/endpoints.service';
import { sanitizeError } from '../lib/sanitizeError';

export const endpointsRouter = Router({ mergeParams: true });
endpointsRouter.use(requireAuth, requireInstanceOwnership);

endpointsRouter.get('/', async (req, res) => {
  res.json({ data: await svc.getEndpoints(req.instance!.id) });
});

endpointsRouter.post('/', validate(createEndpointSchema), async (req, res) => {
  try {
    const ep = await svc.createEndpoint(req.instance!.id, req.body, req.user!.email, req.ip || 'unknown');
    res.status(201).json({ data: ep });
  } catch (err: unknown) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

endpointsRouter.put('/:eid', validate(updateEndpointSchema), async (req, res) => {
  try {
    const ep = await svc.updateEndpoint(req.instance!.id, req.params.eid, req.body, req.user!.email, req.ip || 'unknown');
    res.json({ data: ep });
  } catch (err: unknown) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

endpointsRouter.delete('/:eid', async (req, res) => {
  try {
    await svc.deleteEndpoint(req.instance!.id, req.params.eid, req.user!.email, req.ip || 'unknown');
    res.json({ data: { deleted: true } });
  } catch (err: unknown) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});
