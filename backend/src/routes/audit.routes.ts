/**
 * audit.routes.ts – Audit-log read endpoints
 * Dependencies: auth.middleware, instance.middleware, validate.middleware,
 *               auditQuery.service, isAdmin, query schema
 *
 * Two routers exported:
 *   auditRouter              — per-instance audit (requireInstanceOwnership)
 *   crossInstanceAuditRouter — cross-instance (admin-only; mounted under /admin)
 *
 * Audit_logs is append-only at the DB layer (see migration 013).
 * All query logic lives in services/auditQuery.service.ts.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../lib/asyncHandler';
import { auditQuerySchema } from '../schemas/query.schema';
import { isAdminEmail } from '../lib/isAdmin';
import * as svc from '../services/auditQuery.service';

export const auditRouter = Router({ mergeParams: true });
auditRouter.use(requireAuth, requireInstanceOwnership);

auditRouter.get('/', validate(auditQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const resource = typeof req.query.resource === 'string' ? req.query.resource : undefined;
  const operation = typeof req.query.operation === 'string' ? req.query.operation : undefined;

  const { rows, total } = await svc.listInstanceAudit(req.instance!.id, {
    page, limit, resource, operation,
  });

  res.json({
    data: rows,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}));

// Cross-instance audit router — user scope (no instance ownership check).
// Admins see all rows; non-admins see only audit_logs whose instance they own.
export const crossInstanceAuditRouter = Router();

crossInstanceAuditRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const isAdmin = await isAdminEmail(req.user!.email);
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
  const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);

  const { rows, total } = await svc.listCrossInstanceAudit(userId, isAdmin, { page, limit });

  res.json({ data: rows, meta: { total, page, limit, isAdmin } });
}));
