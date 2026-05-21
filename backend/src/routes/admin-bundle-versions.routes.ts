/**
 * admin-bundle-versions.routes.ts – Admin read API for the bundle history.
 * Dependencies: auth.middleware, admin.middleware, asyncHandler, Zod,
 *               bundle-versions.service
 *
 * Endpoints (all behind requireAuth + requireImiAdmin):
 *   GET    /admin/bundle-versions               — paginated list
 *   GET    /admin/bundle-versions/:id           — single version + parsed bundle
 *   GET    /admin/bundle-versions/:id/download  — raw bundle JSON (Content-Disposition attachment)
 *   GET    /admin/bundle-versions/:idA/diff/:idB
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware';
import { requireImiAdmin } from '../middleware/admin.middleware';
import { asyncHandler } from '../lib/asyncHandler';
import * as svc from '../services/bundle-versions.service';

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const adminBundleVersionsRouter = Router();
adminBundleVersionsRouter.use(requireAuth, requireImiAdmin);

adminBundleVersionsRouter.get('/', asyncHandler(async (req, res) => {
  const parsed = listSchema.parse(req.query);
  const { rows, total } = await svc.listVersions(parsed);
  res.json({
    data: rows,
    meta: { page: parsed.page, limit: parsed.limit, total, pages: Math.ceil(total / parsed.limit) },
  });
}));

adminBundleVersionsRouter.get('/:id', asyncHandler(async (req, res) => {
  const v = await svc.getVersion(req.params.id);
  res.json({ data: v });
}));

adminBundleVersionsRouter.get('/:id/download', asyncHandler(async (req, res) => {
  const v = await svc.getVersion(req.params.id);
  res.setHeader('Content-Type', 'application/fhir+json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="dsf-bundle-v${v.version_number}.json"`,
  );
  res.setHeader('X-Bundle-Signature', v.signature);
  res.setHeader('X-Content-Hash', v.content_hash);
  res.send(v.bundle_json);
}));

adminBundleVersionsRouter.get('/:idA/diff/:idB', asyncHandler(async (req, res) => {
  const diff = await svc.diffVersions(req.params.idA, req.params.idB);
  res.json({ data: diff });
}));
