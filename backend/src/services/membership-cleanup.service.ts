/**
 * membership-cleanup.service.ts – Daily cron that hard-deletes memberships
 * soft-deleted more than 90 days ago. By that point every participating site
 * has consumed at least one allow-list bundle containing the DELETE entry,
 * so the row's only job (signaling "removed") is done.
 *
 * Dependencies: db/connection
 */
import { db } from '../db/connection';

const RETENTION_DAYS = parseInt(process.env.MEMBERSHIP_SOFT_DELETE_RETENTION_DAYS || '90', 10);

export async function runMembershipCleanup(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86400_000);
  const deleted = await db('memberships')
    .whereNotNull('deleted_at')
    .where('deleted_at', '<', cutoff)
    .del();
  if (deleted > 0) {
    console.log(`[membership-cleanup] hard-deleted ${deleted} soft-row(s) older than ${RETENTION_DAYS}d`);
  }
  return deleted;
}
