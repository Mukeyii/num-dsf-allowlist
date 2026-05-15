/**
 * admin.routes.ts – IMI admin-only endpoints
 * Dependencies: auth.middleware, admin.middleware, validate.middleware, audit query schema
 *
 * Endpoints (all behind requireAuth + requireImiAdmin):
 *   GET /admin/instances        — list all instances (cross-tenant view)
 *   GET /admin/audit            — paginated cross-instance audit log
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireImiAdmin } from '../middleware/admin.middleware';
import { validate } from '../middleware/validate.middleware';
import { auditQuerySchema } from '../schemas/query.schema';
import { db } from '../db/connection';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireImiAdmin);

adminRouter.get('/instances', async (req, res) => {
  const instances = await db('instances as i')
    .join('users as u', 'i.user_id', 'u.id')
    .leftJoin('organizations as o', 'o.instance_id', 'i.id')
    .select('i.id', 'i.label', 'i.created_at', 'u.email as user_email', 'o.identifier as org_identifier', 'o.name as org_name')
    .orderBy('i.created_at', 'desc');
  res.json({ data: instances });
});

adminRouter.get('/audit', validate(auditQuerySchema, 'query'), async (req, res) => {
  const { page, limit } = req.query as any;
  const offset = (page - 1) * limit;
  const logs = await db('audit_logs').orderBy('timestamp', 'desc').limit(limit).offset(offset);
  const [{ count }] = await db('audit_logs').count('id as count');
  res.json({ data: logs, meta: { page, limit, total: Number(count), pages: Math.ceil(Number(count) / limit) } });
});
