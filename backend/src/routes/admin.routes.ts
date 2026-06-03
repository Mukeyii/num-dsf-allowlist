/**
 * admin.routes.ts – IMI admin-only endpoints
 * Dependencies: auth.middleware, admin.middleware, validate.middleware,
 *               admin.service, auditQuery.service, asyncHandler
 *
 * Endpoints (all behind requireAuth + requireImiAdmin):
 *   GET /admin/instances        — list all instances (cross-tenant view)
 *   GET /admin/audit            — paginated cross-instance audit log
 *
 * All DB work lives in services/admin.service.ts and
 * services/auditQuery.service.ts — handlers stay thin.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireImiAdmin } from '../middleware/admin.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../lib/asyncHandler';
import { auditQuerySchema } from '../schemas/query.schema';
import { listAllInstances } from '../services/admin.service';
import { listAdminAudit } from '../services/auditQuery.service';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireImiAdmin);

adminRouter.get(
  '/instances',
  asyncHandler(async (_req, res) => {
    res.json({ data: await listAllInstances() });
  }),
);

adminRouter.get(
  '/audit',
  validate(auditQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const { rows, total } = await listAdminAudit({ page, limit });
    res.json({
      data: rows,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }),
);
