/**
 * contacts.routes.ts – Contact CRUD (MEDIC / DSF_ADMIN / SECURITY persons)
 * Dependencies: auth/instance middleware, contact.service, contact schema, asyncHandler
 *
 * DSGVO: contact data is never embedded in the published allow-list bundle.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { validate } from '../middleware/validate.middleware';
import { createContactSchema, updateContactSchema } from '../schemas/contact.schema';
import * as svc from '../services/contacts.service';
import { asyncHandler } from '../lib/asyncHandler';

export const contactsRouter = Router({ mergeParams: true });
contactsRouter.use(requireAuth, requireInstanceOwnership);

contactsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ data: await svc.getContacts(req.instance!.id) });
  }),
);

contactsRouter.post(
  '/',
  validate(createContactSchema),
  asyncHandler(async (req, res) => {
    const contact = await svc.createContact(
      req.instance!.id,
      req.body,
      req.user!.email,
      req.ip || 'unknown',
    );
    res.status(201).json({ data: contact });
  }),
);

contactsRouter.put(
  '/:cid',
  validate(updateContactSchema),
  asyncHandler(async (req, res) => {
    const contact = await svc.updateContact(
      req.instance!.id,
      req.params.cid,
      req.body,
      req.user!.email,
      req.ip || 'unknown',
    );
    res.json({ data: contact });
  }),
);

contactsRouter.delete(
  '/:cid',
  asyncHandler(async (req, res) => {
    await svc.deleteContact(req.instance!.id, req.params.cid, req.user!.email, req.ip || 'unknown');
    res.json({ data: { deleted: true } });
  }),
);

contactsRouter.post(
  '/:cid/resend-verification',
  asyncHandler(async (req, res) => {
    await svc.resendVerification(
      req.instance!.id,
      req.params.cid,
      req.user!.email,
      req.ip || 'unknown',
    );
    res.json({ data: { message: 'Verification email sent.' } });
  }),
);
