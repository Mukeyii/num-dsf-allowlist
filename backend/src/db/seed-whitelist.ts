/**
 * seed-whitelist.ts – Seed first admin email into the whitelist
 * Usage: npx ts-node src/db/seed-whitelist.ts admin@example.com
 * Dependencies: db/connection, uuid
 */
import 'dotenv/config';
import { db } from './connection';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx ts-node src/db/seed-whitelist.ts <email>');
    process.exit(1);
  }

  const normalized = email.toLowerCase().trim();
  await db('email_whitelist').insert({
    id: uuidv4(),
    email: normalized,
    created_by: 'seed',
    created_at: new Date(),
  }).onConflict('email').ignore();

  console.log(`✓ Whitelisted: ${normalized}`);
  await db.destroy();
}

main().catch(console.error);
