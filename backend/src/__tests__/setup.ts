// Purpose: Global Jest setup/teardown – connects to DB and destroys pool after all tests
// Dependencies: db/connection (Knex instance), redis.service

import { db } from '../db/connection';
import { redis } from '../services/redis.service';

beforeAll(async () => {
  try {
    const result = await db.raw('SELECT DATABASE() as dbName');
    console.log(`[Test] Connected to DB: ${result[0][0].dbName}`);
  } catch {
    console.warn('[Test] DB not available – skipping connection check (unit tests)');
  }
});

afterAll(async () => {
  await db.destroy();
  redis.disconnect();
});
