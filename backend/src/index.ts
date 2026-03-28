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
