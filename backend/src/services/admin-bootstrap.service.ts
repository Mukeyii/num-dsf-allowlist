/**
 * admin-bootstrap.service.ts – On backend startup: if admin_grants is empty,
 * create signed grants from IMI_ADMIN_EMAILS env var. Idempotent.
 * After first successful run, the env var is ignored at runtime.
 * Dependencies: db/connection, lib/adminGrants
 */
import { db } from '../db/connection';
import { signGrant } from '../lib/adminGrants';

export async function bootstrapAdminGrants(): Promise<void> {
  try {
    const existing = await db('admin_grants').count('email as n').first();
    const n = Number((existing as { n: number | string } | undefined)?.n ?? 0);
    if (n > 0) return;

    const raw = process.env.IMI_ADMIN_EMAILS || '';
    const emails = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (emails.length === 0) {
      console.warn('[admin-bootstrap] admin_grants empty AND IMI_ADMIN_EMAILS not set — no admins exist');
      return;
    }

    const now = new Date();
    for (const email of emails) {
      const sig = signGrant(email, now, 'SYSTEM:bootstrap', 'SYSTEM:bootstrap');
      await db('admin_grants').insert({
        email,
        granted_at: now,
        granted_by_a: 'SYSTEM:bootstrap',
        granted_by_b: 'SYSTEM:bootstrap',
        signature_hex: sig,
      }).onConflict('email').ignore();
    }
    console.warn(`[admin-bootstrap] Created ${emails.length} signed admin_grants from IMI_ADMIN_EMAILS. Future runs will ignore the env var.`);
  } catch (err) {
    console.error('[admin-bootstrap] failed', err);
  }
}
