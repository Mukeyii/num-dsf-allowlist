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
import { sanitizeError } from '../lib/sanitizeError';

export const endpointsRouter = Router({ mergeParams: true });
endpointsRouter.use(requireAuth, requireInstanceOwnership);

endpointsRouter.get('/', async (req, res) => {
  res.json({ data: await svc.getEndpoints(req.instance!.id) });
});

// A duplicate endpoint identifier is a 409 conflict; ENDPOINT_EXISTS is not a
// sanitizeError business code (it would collapse to OPERATION_FAILED), so map
// it explicitly with a non-leaky message. Everything else keeps the 400 +
// sanitizeError template the other endpoint routes use.
endpointsRouter.post('/', validate(createEndpointSchema), async (req, res) => {
  try {
    const ep = await svc.createEndpoint(
      req.instance!.id,
      req.body,
      req.user!.email,
      req.ip || 'unknown',
    );
    res.status(201).json({ data: ep });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'ENDPOINT_EXISTS') {
      return res.status(409).json({
        error: { code: 'ENDPOINT_EXISTS', message: 'Endpoint identifier already registered' },
      });
    }
    res.status(400).json({ error: sanitizeError(err) });
  }
});

endpointsRouter.put(
  '/:eid',
  validate(updateEndpointSchema),
  asyncHandler(async (req, res) => {
    const ep = await svc.updateEndpoint(
      req.instance!.id,
      req.params.eid,
      req.body,
      req.user!.email,
      req.ip || 'unknown',
    );
    res.json({ data: ep });
  }),
);

endpointsRouter.delete(
  '/:eid',
  asyncHandler(async (req, res) => {
    await svc.deleteEndpoint(
      req.instance!.id,
      req.params.eid,
      req.user!.email,
      req.ip || 'unknown',
    );
    res.json({ data: { deleted: true } });
  }),
);
