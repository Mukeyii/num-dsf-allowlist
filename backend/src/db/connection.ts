/**
 * connection.ts – MySQL connection via Knex
 * Depends on: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD env vars
 */
import knex from 'knex';

export const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_NAME || 'dsf_allowlist',
    user: process.env.DB_USER || 'dsf',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4',
  },
  pool: { min: 2, max: 10 },
});

export async function testDbConnection(): Promise<void> {
  await db.raw('SELECT 1');
}
