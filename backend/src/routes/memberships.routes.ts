/**
 * memberships.routes.ts – Membership CRUD (DIC, HRP, parent_organization)
 * Dependencies: auth/instance middleware, membership.service, membership schema, sanitizeError
 *
 * Soft-delete via memberships.deleted_at (see migration 004) — DELETE
 * emits an OrganizationAffiliation DELETE entry in the FHIR bundle so
 * consumers can drop the relationship without resyncing.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireInstanceOwnership } from '../middleware/instance.middleware';
import { validate } from '../middleware/validate.middleware';
import { createMembershipSchema, updateMembershipSchema } from '../schemas/membership.schema';
import * as svc from '../services/memberships.service';
import { sanitizeError } from '../lib/sanitizeError';

export const membershipsRouter = Router({ mergeParams: true });
membershipsRouter.use(requireAuth, requireInstanceOwnership);

membershipsRouter.get('/', async (req, res) => {
  res.json({ data: await svc.getMemberships(req.instance!.id) });
});

membershipsRouter.post('/', validate(createMembershipSchema), async (req, res) => {
  try {
    const ms = await svc.createMembership(req.instance!.id, req.body, req.user!.email, req.ip || 'unknown');
    res.status(201).json({ data: ms });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

membershipsRouter.put('/:mid', validate(updateMembershipSchema), async (req, res) => {
  try {
    const ms = await svc.updateMembership(req.instance!.id, req.params.mid, req.body, req.user!.email, req.ip || 'unknown');
    res.json({ data: ms });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});

membershipsRouter.delete('/:mid', async (req, res) => {
  try {
    await svc.deleteMembership(req.instance!.id, req.params.mid, req.user!.email, req.ip || 'unknown');
    res.json({ data: { deleted: true } });
  } catch (err: any) {
    res.status(400).json({ error: sanitizeError(err) });
  }
});
