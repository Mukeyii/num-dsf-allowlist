/**
 * membership-cleanup.service.ts – Daily cron that hard-deletes memberships
 * soft-deleted more than 90 days ago. By that point every participating site
 * has consumed at least one allow-list bundle containing the DELETE entry,
 * so the row's only job (signaling "removed") is done.
 *
 * Dependencies: db/connection, audit.service
 */
import { db } from '../db/connection';
import { writeAuditLog } from './audit.service';
import { logger } from '../lib/logger';

const RETENTION_DAYS = parseInt(process.env.MEMBERSHIP_SOFT_DELETE_RETENTION_DAYS || '90', 10);

export async function runMembershipCleanup(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86400_000);
  const rows = await db('memberships')
    .whereNotNull('deleted_at')
    .where('deleted_at', '<', cutoff)
    .select('id');
  if (rows.length === 0) return 0;
  const ids = rows.map((r: { id: string }) => r.id);
  await db('memberships').whereIn('id', ids).del();
  await writeAuditLog({
    userEmail: 'SYSTEM:membership-cleanup',
    resourceType: 'MEMBERSHIP',
    operation: 'DELETE',
    diffJson: { ids },
  }).catch(() => {});
  logger.info(`[membership-cleanup] hard-deleted ${ids.length} soft-row(s) older than ${RETENTION_DAYS}d`);
  return ids.length;
}
