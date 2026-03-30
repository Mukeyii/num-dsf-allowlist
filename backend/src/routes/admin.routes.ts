import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireImiAdmin } from '../middleware/admin.middleware';
import { validate } from '../middleware/validate.middleware';
import { auditQuerySchema } from '../schemas/query.schema';
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { writeAuditLog } from '../services/audit.service';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireImiAdmin);

adminRouter.get('/whitelist', async (req, res) => {
  const list = await db('email_whitelist').orderBy('created_at', 'desc');
  res.json({ data: list });
});

adminRouter.post('/whitelist', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: { code: 'VALIDATION', message: 'email required' } });
  const normalized = email.toLowerCase().trim();
  const existing = await db('email_whitelist').where({ email: normalized }).first();
  if (existing) return res.status(409).json({ error: { code: 'CONFLICT', message: 'Email already whitelisted' } });
  const id = uuidv4();
  await db('email_whitelist').insert({ id, email: normalized, created_by: req.user!.email, created_at: new Date() });
  await writeAuditLog({ userEmail: req.user!.email, resourceType: 'AUTH', resourceId: normalized, operation: 'CREATE', ipAddress: req.ip });
  res.status(201).json({ data: { id, email: normalized } });
});

adminRouter.delete('/whitelist/:email', async (req, res) => {
  const email = decodeURIComponent(req.params.email).toLowerCase().trim();
  if (email === req.user!.email) return res.status(400).json({ error: { code: 'VALIDATION', message: 'Cannot remove your own email' } });
  await db('email_whitelist').where({ email }).delete();
  await writeAuditLog({ userEmail: req.user!.email, resourceType: 'AUTH', resourceId: email, operation: 'DELETE', ipAddress: req.ip });
  res.json({ data: { deleted: true } });
});

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
