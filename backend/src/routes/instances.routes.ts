import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { db } from '../db/connection';
import { writeAuditLog } from '../services/audit.service';
import { v4 as uuidv4 } from 'uuid';

export const instancesRouter = Router();
instancesRouter.use(requireAuth);

instancesRouter.get('/', async (req, res) => {
  const instances = await db('instances')
    .where({ user_id: req.user!.id })
    .orderBy('created_at', 'asc');
  const enriched = await Promise.all(instances.map(async (inst: any) => {
    const org = await db('organizations').where({ instance_id: inst.id }).first();
    return { ...inst, label: org?.identifier || inst.label || inst.id };
  }));
  res.json({ data: enriched });
});

instancesRouter.post('/', async (req, res) => {
  const id = uuidv4();
  await db('instances').insert({
    id, user_id: req.user!.id, label: id, created_at: new Date(),
  });
  await writeAuditLog({
    userEmail: req.user!.email, resourceType: 'ORGANIZATION',
    resourceId: id, operation: 'CREATE', ipAddress: req.ip,
  });
  const instance = await db('instances').where({ id }).first();
  res.status(201).json({ data: instance });
});

instancesRouter.get('/:id', async (req, res) => {
  const instance = await db('instances')
    .where({ id: req.params.id, user_id: req.user!.id }).first();
  if (!instance) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Instance not found' } });
  res.json({ data: instance });
});

instancesRouter.put('/:id/label', async (req, res) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: { code: 'VALIDATION', message: 'label required' } });
  const instance = await db('instances').where({ id: req.params.id, user_id: req.user!.id }).first();
  if (!instance) return res.status(403).json({ error: { code: 'FORBIDDEN' } });
  await db('instances').where({ id: req.params.id }).update({ label });
  res.json({ data: { ...instance, label } });
});
