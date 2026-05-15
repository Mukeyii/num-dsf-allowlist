/**
 * index.ts – Server Entry Point
 * Validates environment, connects to DB/Redis, starts scheduler, and listens.
 * Dependencies: app.ts, db/connection, services/redis.service, services/scheduler.service
 */
import 'dotenv/config';
import { app } from './app';
import { testDbConnection } from './db/connection';
import { testRedisConnection } from './services/redis.service';
import { startScheduler } from './services/scheduler.service';
import { bootstrapAdminGrants } from './services/admin-bootstrap.service';
import { logger } from './lib/logger';

const PORT = process.env.PORT || 3000;

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
    logger.fatal({ missing }, 'Missing required environment variables');
    process.exit(1);
  }
  if ((process.env.TOTP_ENCRYPTION_KEY || '').length !== 64) {
    logger.fatal('TOTP_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    process.exit(1);
  }
  try {
    const privKey = Buffer.from(process.env.JWT_PRIVATE_KEY_BASE64!, 'base64').toString();
    if (!privKey.includes('PRIVATE KEY')) throw new Error('Invalid private key');
  } catch {
    logger.fatal('JWT_PRIVATE_KEY_BASE64 is invalid');
    process.exit(1);
  }
  logger.info('Environment variables validated');
}

// Startup
async function start() {
  validateEnv();
  try {
    await testDbConnection();
    logger.info('MySQL connected');
    await testRedisConnection();
    logger.info('Redis connected');
    startScheduler();
    await bootstrapAdminGrants();
    if (process.env.DEV_AUTO_LOGIN === 'true') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('DEV_AUTO_LOGIN must NEVER be enabled in production');
      }
      const host = process.env.HOST || '0.0.0.0';
      const isLocal = host === '127.0.0.1' || host === 'localhost';
      if (!isLocal) {
        logger.warn(`[security] DEV_AUTO_LOGIN=true but HOST=${host}; binding accepted because NODE_ENV is not production. If exposing this dev process beyond localhost (ngrok, tunnel, etc.), unset DEV_AUTO_LOGIN first.`);
      }
    }
    // DEV_TOTP_BYPASS short-circuits ALL admin step-up TOTP checks. Allow
    // only when this is genuinely a dev container: NODE_ENV === 'development'
    // AND bound to localhost. Anything else (staging, preview, accidental
    // prod-like deploy) must hard-abort, regardless of DEV_AUTO_LOGIN state.
    if (process.env.DEV_TOTP_BYPASS === 'true') {
      const host = process.env.HOST || '0.0.0.0';
      const isLocal = host === '127.0.0.1' || host === 'localhost';
      if (process.env.NODE_ENV !== 'development' || !isLocal) {
        throw new Error(
          `DEV_TOTP_BYPASS=true is only allowed with NODE_ENV=development on a localhost bind ` +
          `(got NODE_ENV=${process.env.NODE_ENV}, HOST=${host}). Refusing to start.`
        );
      }
      logger.warn('[security] DEV_TOTP_BYPASS=true — admin step-up TOTP checks are DISABLED for this dev process');
    }
    app.listen(PORT, () => {
      logger.info({ port: PORT, env: process.env.DSF_ENVIRONMENT }, 'Server started');
    });
  } catch (err) {
    logger.fatal({ err }, 'Startup failed');
    process.exit(1);
  }
}

start();
