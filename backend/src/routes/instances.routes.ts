/**
 * instances.routes.ts – Instance CRUD
 * Dependencies: auth.middleware, db/connection, uuid
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

export const instancesRouter = Router();
instancesRouter.use(requireAuth);

instancesRouter.get('/', async (req, res) => {
  const instances = await db('instances')
    .where({ user_id: req.user!.id })
    .orderBy('created_at', 'desc');
  res.json({ data: instances });
});

instancesRouter.post('/', async (req, res) => {
  const { label } = req.body;
  if (!label || typeof label !== 'string') {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'Label required' } });
  }
  const id = uuidv4();
  await db('instances').insert({
    id,
    user_id: req.user!.id,
    label,
    created_at: new Date(),
  });
  const instance = await db('instances').where({ id }).first();
  res.status(201).json({ data: instance });
});

instancesRouter.get('/:id', async (req, res) => {
  const instance = await db('instances')
    .where({ id: req.params.id, user_id: req.user!.id })
    .first();
  if (!instance) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Instance not found' } });
  }
  res.json({ data: instance });
});
