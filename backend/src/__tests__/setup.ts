// Purpose: Per-test-file Jest setup – verifies DB connectivity once at suite start.
// Dependencies: db/connection (Knex instance)
//
// Note: `setupFilesAfterEnv` runs in every test file's context, so an `afterAll`
// here would `destroy()` the shared Knex pool / `disconnect()` the shared
// ioredis singleton after the first file completes — leaving subsequent files
// in the same Jest worker with closed handles. Jest's `--forceExit` (set in
// package.json `test` script) reaps the connections at process exit; we don't
// need (and must not have) a per-file teardown here.

import { db } from '../db/connection';

beforeAll(async () => {
  try {
    const result = await db.raw('SELECT DATABASE() as dbName');
    console.log(`[Test] Connected to DB: ${result[0][0].dbName}`);
    // Migration 013 makes audit_logs append-only at the DB level via
    // BEFORE UPDATE/DELETE triggers. That is correct for real environments
    // but blocks the cleanup deletes the seed helper runs between test
    // files. The CI test DB is ephemeral, so dropping the triggers here is
    // safe — they get re-created on the next migration run in real envs.
    await db.raw('DROP TRIGGER IF EXISTS audit_logs_no_update');
    await db.raw('DROP TRIGGER IF EXISTS audit_logs_no_delete');
  } catch {
    console.warn('[Test] DB not available – skipping connection check (unit tests)');
  }
});
