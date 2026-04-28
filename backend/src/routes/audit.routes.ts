import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { validate } from '../middleware/validate.middleware';
import { auditQuerySchema } from '../schemas/query.schema';
import { db } from '../db/connection';
import { isAdminEmail } from '../lib/isAdmin';

export const auditRouter = Router({ mergeParams: true });
auditRouter.use(requireAuth, requireInstanceOwnership);

auditRouter.get('/', validate(auditQuerySchema, 'query'), async (req, res) => {
  const { page, limit } = req.query as any;
  const offset = (page - 1) * limit;

  const query = db('audit_logs')
    .where({ instance_id: req.instance!.id })
    .orderBy('timestamp', 'desc');

  if (req.query.resource) query.where({ resource_type: req.query.resource });
  if (req.query.operation) query.where({ operation: req.query.operation });

  const [logs, [{ count }]] = await Promise.all([
    query.clone().limit(limit).offset(offset),
    query.clone().count('id as count'),
  ]);

  res.json({
    data: logs,
    meta: { page, limit, total: Number(count), pages: Math.ceil(Number(count) / limit) },
  });
});

// Cross-instance audit router — user scope (no instance ownership check)
export const crossInstanceAuditRouter = Router();

crossInstanceAuditRouter.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const isAdmin = await isAdminEmail(req.user!.email);
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
  const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
  const offset = (page - 1) * limit;

  const baseQuery = db('audit_logs')
    .leftJoin('instances', 'audit_logs.instance_id', 'instances.id')
    .leftJoin('organizations', 'organizations.instance_id', 'instances.id')
    .select(
      'audit_logs.id',
      'audit_logs.timestamp',
      'audit_logs.user_email',
      'audit_logs.instance_id',
      'audit_logs.resource_type',
      'audit_logs.resource_id',
      'audit_logs.operation',
      'audit_logs.diff_json',
      'audit_logs.ip_address',
      'instances.label as instance_label',
      'organizations.identifier as organization_identifier',
      'organizations.name as organization_name',
    );
  if (!isAdmin) baseQuery.where('instances.user_id', userId);
  const rows = await baseQuery.orderBy('audit_logs.timestamp', 'desc').limit(limit).offset(offset);

  const totalQuery = db('audit_logs').leftJoin('instances', 'audit_logs.instance_id', 'instances.id');
  if (!isAdmin) totalQuery.where('instances.user_id', userId);
  const totalRow = await totalQuery.count('audit_logs.id as total').first();
  const total = Number(totalRow?.total ?? 0);

  res.json({ data: rows, meta: { total, page, limit, isAdmin } });
});
