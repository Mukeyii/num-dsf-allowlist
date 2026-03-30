import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { validate } from '../middleware/validate.middleware';
import { auditQuerySchema } from '../schemas/query.schema';
import { db } from '../db/connection';

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
