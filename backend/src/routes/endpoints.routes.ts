/**
 * endpoints.routes.ts – DSF FHIR endpoint CRUD + IP list
 * Dependencies: auth/instance middleware, endpoint.service, endpoint schema, asyncHandler
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { validate } from '../middleware/validate.middleware';
import { createEndpointSchema, updateEndpointSchema } from '../schemas/endpoint.schema';
import * as svc from '../services/endpoints.service';
import { asyncHandler } from '../lib/asyncHandler';

export const endpointsRouter = Router({ mergeParams: true });
endpointsRouter.use(requireAuth, requireInstanceOwnership);

endpointsRouter.get('/', async (req, res) => {
  res.json({ data: await svc.getEndpoints(req.instance!.id) });
});

endpointsRouter.post('/', validate(createEndpointSchema), asyncHandler(async (req, res) => {
  const ep = await svc.createEndpoint(req.instance!.id, req.body, req.user!.email, req.ip || 'unknown');
  res.status(201).json({ data: ep });
}));

endpointsRouter.put('/:eid', validate(updateEndpointSchema), asyncHandler(async (req, res) => {
  const ep = await svc.updateEndpoint(req.instance!.id, req.params.eid, req.body, req.user!.email, req.ip || 'unknown');
  res.json({ data: ep });
}));

endpointsRouter.delete('/:eid', asyncHandler(async (req, res) => {
  await svc.deleteEndpoint(req.instance!.id, req.params.eid, req.user!.email, req.ip || 'unknown');
  res.json({ data: { deleted: true } });
}));
