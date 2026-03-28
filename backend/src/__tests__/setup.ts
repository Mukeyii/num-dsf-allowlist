// Purpose: Global Jest setup/teardown – connects to DB and destroys pool after all tests
// Dependencies: db/connection (Knex instance)

import { db } from '../db/connection';

beforeAll(async () => {
  const result = await db.raw('SELECT DATABASE() as dbName');
  console.log(`[Test] Connected to DB: ${result[0][0].dbName}`);
});

afterAll(async () => {
  await db.destroy();
});
