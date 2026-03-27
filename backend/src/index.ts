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
import { downloadRouter } from './routes/download.routes';
import { auditRouter } from './routes/audit.routes';
import { testDbConnection } from './db/connection';
import { testRedisConnection } from './services/redis.service';
import { apiRateLimit } from './middleware/rateLimit.middleware';

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
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

// Admin (GECKO operator)
app.use('/api/v1/admin', approvalRouter);

// Health Check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', environment: process.env.DSF_ENVIRONMENT || 'UNKNOWN' });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Startup
async function start() {
  try {
    await testDbConnection();
    console.log('✓ MySQL connected');
    await testRedisConnection();
    console.log('✓ Redis connected');
    app.listen(PORT, () => {
      console.log(`✓ Backend running on port ${PORT} [${process.env.DSF_ENVIRONMENT}]`);
    });
  } catch (err) {
    console.error('✗ Startup failed:', err);
    process.exit(1);
  }
}

start();
