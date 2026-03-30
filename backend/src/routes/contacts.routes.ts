import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { validate } from '../middleware/validate.middleware';
import { createContactSchema, updateContactSchema } from '../schemas/contact.schema';
import * as svc from '../services/contacts.service';
import { sanitizeError } from '../lib/sanitizeError';

export const contactsRouter = Router({ mergeParams: true });
contactsRouter.use(requireAuth, requireInstanceOwnership);

contactsRouter.get('/', async (req, res) => {
  res.json({ data: await svc.getContacts(req.instance!.id) });
});

contactsRouter.post('/', validate(createContactSchema), async (req, res) => {
  try {
    const contact = await svc.createContact(req.instance!.id, req.body, req.user!.email, req.ip || 'unknown');
    res.status(201).json({ data: contact });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

contactsRouter.put('/:cid', validate(updateContactSchema), async (req, res) => {
  try {
    const contact = await svc.updateContact(req.instance!.id, req.params.cid, req.body, req.user!.email, req.ip || 'unknown');
    res.json({ data: contact });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

contactsRouter.delete('/:cid', async (req, res) => {
  try {
    await svc.deleteContact(req.instance!.id, req.params.cid, req.user!.email, req.ip || 'unknown');
    res.json({ data: { deleted: true } });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

contactsRouter.post('/:cid/resend-verification', async (req, res) => {
  try {
    await svc.resendVerification(req.instance!.id, req.params.cid, req.user!.email, req.ip || 'unknown');
    res.json({ data: { message: 'Verification email sent.' } });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});
