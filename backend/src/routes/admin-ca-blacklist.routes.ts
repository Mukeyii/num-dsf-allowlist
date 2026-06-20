/**
 * admin-ca-blacklist.routes.ts – Admin CRUD for the CA blacklist + read-only
 * picker over the known_cas Mozilla-cache.
 * Writes (add/delete) require a fresh TOTP step-up, matching the other admin
 * write routers.
 * Dependencies: auth.middleware, admin.middleware, totp.middleware,
 *               rateLimit.middleware, asyncHandler, ca-blacklist.service, Zod
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware';
import { requireImiAdmin } from '../middleware/admin.middleware';
import { requireFreshTotp } from '../middleware/totp.middleware';
import { stepUpTotpRateLimit } from '../middleware/rateLimit.middleware';
import { asyncHandler } from '../lib/asyncHandler';
import * as svc from '../services/ca-blacklist.service';

const addSchema = z.object({
  subjectDn: z.string().min(3).max(500),
  fingerprint: z
    .string()
    .regex(/^[A-Fa-f0-9]{64}$/)
    .optional(),
  reason: z.string().max(2000).optional(),
  totpCode: z.string().length(6),
});

export const adminCaBlacklistRouter = Router();
adminCaBlacklistRouter.use(requireAuth, requireImiAdmin);

// Step-up rate limiter for the TOTP-gated writes (skipped under jest).
const stepUp = process.env.NODE_ENV === 'test' ? [] : [stepUpTotpRateLimit];

adminCaBlacklistRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [blacklist, knownCas] = await Promise.all([svc.listBlacklist(), svc.listKnownCas()]);
    res.json({ data: { blacklist, knownCas } });
  }),
);

adminCaBlacklistRouter.post(
  '/',
  ...stepUp,
  requireFreshTotp,
  asyncHandler(async (req, res) => {
    const parsed = addSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION', message: parsed.error.errors[0]?.message || 'Invalid input' },
      });
    }
    const { totpCode: _totpCode, ...entry } = parsed.data;
    const id = await svc.addToBlacklist(entry, req.user!.email);
    res.status(201).json({ data: { id } });
  }),
);

adminCaBlacklistRouter.delete(
  '/:id',
  ...stepUp,
  requireFreshTotp,
  asyncHandler(async (req, res) => {
    await svc.removeFromBlacklist(req.params.id, req.user!.email);
    res.json({ data: { deleted: true } });
  }),
);
