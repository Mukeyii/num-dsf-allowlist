/**
 * auth.routes.ts – Auth route placeholders
 * Will be fully implemented in Phase 2 (Auth-Backend)
 */
import { Router } from 'express';

export const authRouter = Router();

authRouter.post('/request-otp', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } });
});

authRouter.post('/verify-otp', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } });
});

authRouter.post('/verify-totp', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } });
});

authRouter.post('/setup-totp', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } });
});

authRouter.post('/confirm-totp', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } });
});

authRouter.post('/logout', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } });
});

authRouter.post('/refresh', (_req, res) => {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase 2' } });
});
