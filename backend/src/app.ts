/**
 * app.ts – Express App Setup
 * Configures and exports the Express app without starting the server.
 * Used by index.ts (production) and tests (supertest).
 * Dependencies: all route modules, middleware, express, helmet, cors, cookie-parser
 */
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes';
import { meRouter } from './routes/me.routes';
import { instancesRouter } from './routes/instances.routes';
import { organizationRouter } from './routes/organization.routes';
import { contactsRouter } from './routes/contacts.routes';
import { endpointsRouter } from './routes/endpoints.routes';
import { certificatesRouter } from './routes/certificates.routes';
import { membershipsRouter } from './routes/memberships.routes';
import { approvalRouter } from './routes/approval.routes';
import { adminApprovalRouter } from './routes/admin-approval.routes';
import { adminUsersRouter } from './routes/admin-users.routes';
import { adminPromotionsRouter } from './routes/admin-promotions.routes';
import { adminRouter } from './routes/admin.routes';
import { downloadRouter } from './routes/download.routes';
import { auditRouter, crossInstanceAuditRouter } from './routes/audit.routes';
import { fhirRouter } from './routes/fhir.routes';
import { networkRouter } from './routes/network.routes';
import { marketplaceRouter } from './routes/marketplace.routes';
import { adminMarketplaceRouter } from './routes/admin-marketplace.routes';
import { apiRateLimit } from './middleware/rateLimit.middleware';
import { randomUUID } from 'crypto';
import { logger } from './lib/logger';

const app = express();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser());

// Trust nginx proxy
app.set('trust proxy', 1);

// Request ID + structured logging
app.use((req: any, _res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID();
  next();
});

// Rate limiting on API routes — skip in test environment to avoid flaky tests
if (process.env.NODE_ENV !== 'test') {
  app.use('/api', apiRateLimit);
}

// FHIR Bundle endpoint — machine-to-machine, mTLS auth via client cert thumbprint (no JWT required)
app.use('/fhir', fhirRouter);

// Routes
app.use('/auth/me', meRouter);
app.use('/auth', authRouter);
app.use('/api/v1/instances', instancesRouter);

// Entity routes under /api/v1/instances/:instanceId/
app.use('/api/v1/instances/:instanceId/organization', organizationRouter);
app.use('/api/v1/instances/:instanceId/contacts', contactsRouter);
app.use('/api/v1/instances/:instanceId/endpoints', endpointsRouter);
app.use('/api/v1/instances/:instanceId/certificates', certificatesRouter);
app.use('/api/v1/instances/:instanceId/memberships', membershipsRouter);
app.use('/api/v1/instances/:instanceId/approval', approvalRouter);
app.use('/api/v1/instances/:instanceId/download', downloadRouter);
app.use('/api/v1/instances/:instanceId/audit', auditRouter);

// Download without instance scope (IP address list for all orgs)
app.use('/api/v1/download', downloadRouter);

// Cross-instance audit log (user scope — all instances the user owns; admin scope — all instances)
app.use('/api/v1/audit', crossInstanceAuditRouter);

// Cross-instance allow-list network map (all authenticated users)
app.use('/api/v1/network', networkRouter);

// Admin routes
app.use('/api/v1/admin/approval', adminApprovalRouter);
app.use('/api/v1/admin/users', adminUsersRouter);
app.use('/api/v1/admin/promotions', adminPromotionsRouter);
app.use('/api/v1/admin/marketplace', adminMarketplaceRouter);
app.use('/api/v1/admin', adminRouter);

// Marketplace (read, auth required)
app.use('/api/v1/marketplace', marketplaceRouter);

// Health Check — liveness (always ok) and readiness (checks DB + Redis)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health/live', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health/ready', async (_req, res) => {
  const checks: Record<string, string> = { db: 'ok', redis: 'ok' };
  try {
    const { db: knex } = await import('./db/connection');
    await knex.raw('SELECT 1');
  } catch (err) {
    logger.error({ err }, 'health.ready: db check failed');
    checks.db = 'error';
  }
  try {
    const { redis } = await import('./services/redis.service');
    await redis.ping();
  } catch (err) {
    logger.error({ err }, 'health.ready: redis check failed');
    checks.redis = 'error';
  }
  const allOk = checks.db === 'ok' && checks.redis === 'ok';
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    ...checks,
  });
});

// 404
app.use((_req: any, res: any) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Global error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error({ err, requestId: _req.id }, 'Unhandled error');
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'Invalid input', details: err.errors } });
  }
  if (err.message === 'PRIVATE_KEY_REJECTED') {
    return res.status(400).json({ error: { code: 'SECURITY', message: 'Private key material detected.' } });
  }
  if (err.message?.includes('NOT_FOUND')) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
  }
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An internal error occurred.' : err.message,
    },
  });
});

export { app };
