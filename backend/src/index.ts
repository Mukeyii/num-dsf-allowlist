/**
 * index.ts – Express App Bootstrap
 * Starts the server, registers middleware and all routes
 */
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes';
import { instancesRouter } from './routes/instances.routes';
import { organizationRouter } from './routes/organization.routes';
import { contactsRouter } from './routes/contacts.routes';
import { endpointsRouter } from './routes/endpoints.routes';
import { certificatesRouter } from './routes/certificates.routes';
import { membershipsRouter } from './routes/memberships.routes';
import { approvalRouter } from './routes/approval.routes';
import { adminRouter } from './routes/admin.routes';
import { downloadRouter } from './routes/download.routes';
import { auditRouter } from './routes/audit.routes';
import { testDbConnection } from './db/connection';
import { testRedisConnection } from './services/redis.service';
import { apiRateLimit } from './middleware/rateLimit.middleware';
import { startScheduler } from './services/scheduler.service';

const app = express();
const PORT = process.env.PORT || 3000;

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

// Rate limiting on API routes
app.use('/api', apiRateLimit);

// Routes
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

// Admin routes
app.use('/api/v1/admin/approval', approvalRouter);
app.use('/api/v1/admin', adminRouter);

// Health Check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', environment: process.env.DSF_ENVIRONMENT || 'UNKNOWN' });
});

// 404
app.use((_req: any, res: any) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Global error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Error]', err.stack || err.message);
  } else {
    console.error('[Error]', err.message || 'Unknown error');
  }
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

function validateEnv(): void {
  const required = [
    'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
    'REDIS_URL',
    'JWT_PRIVATE_KEY_BASE64', 'JWT_PUBLIC_KEY_BASE64',
    'TOTP_ENCRYPTION_KEY',
    'MAIL_FROM',
    'DSF_ENVIRONMENT',
  ];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('✗ Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    process.exit(1);
  }
  if ((process.env.TOTP_ENCRYPTION_KEY || '').length !== 64) {
    console.error('✗ TOTP_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    process.exit(1);
  }
  try {
    const privKey = Buffer.from(process.env.JWT_PRIVATE_KEY_BASE64!, 'base64').toString();
    if (!privKey.includes('PRIVATE KEY')) throw new Error('Invalid private key');
  } catch {
    console.error('✗ JWT_PRIVATE_KEY_BASE64 is invalid');
    process.exit(1);
  }
  console.log('✓ Environment variables validated');
}

// Startup
async function start() {
  validateEnv();
  try {
    await testDbConnection();
    console.log('✓ MySQL connected');
    await testRedisConnection();
    console.log('✓ Redis connected');
    startScheduler();
    app.listen(PORT, () => {
      console.log(`✓ Backend running on port ${PORT} [${process.env.DSF_ENVIRONMENT}]`);
    });
  } catch (err) {
    console.error('✗ Startup failed:', err);
    process.exit(1);
  }
}

start();
