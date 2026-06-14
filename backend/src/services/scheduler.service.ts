/**
 * scheduler.service.ts – Cron job management
 * Every 5 min:        flush due pending_notifications (site emails after approve/reject)
 * Daily 06:00 UTC:    approval reminders
 * Daily 07:00 UTC:    silent consent sweep
 * Daily 08:00 UTC:    cert expiry check
 * Daily 09:00 UTC:    membership cleanup
 * Daily 10:00 UTC:    marketplace GitHub metadata sync
 */
import cron from 'node-cron';
import { runCertExpiryCheck } from './cert-monitor.service';
import { runApprovalReminders, flushPendingNotifications } from './approval-reminder.service';
import { runSilentConsentSweep } from './approval-silent-consent.service';
import { runMembershipCleanup } from './membership-cleanup.service';
import { syncAll as syncMarketplaceAll } from './marketplace-sync.service';
import { logger } from '../lib/logger';

// The marketplace sweep walks every entry with a delay between GitHub calls, so
// a slow run can outlast its daily interval. This guard drops a tick that would
// otherwise overlap an in-flight sweep.
let marketplaceSyncRunning = false;

export function startScheduler(): void {
  cron.schedule(
    '*/5 * * * *',
    async () => {
      try {
        await flushPendingNotifications();
      } catch (err) {
        logger.error({ err }, '[Scheduler] flushPendingNotifications failed');
      }
    },
    { timezone: 'UTC' },
  );

  cron.schedule(
    '0 6 * * *',
    async () => {
      try {
        await runApprovalReminders();
      } catch (err) {
        logger.error({ err }, '[Scheduler] ApprovalReminders failed');
      }
    },
    { timezone: 'UTC' },
  );

  cron.schedule(
    '0 7 * * *',
    async () => {
      try {
        const n = await runSilentConsentSweep();
        if (n > 0) logger.info(`[silent-consent] promoted ${n} request(s)`);
      } catch (err) {
        logger.error({ err }, '[silent-consent] sweep failed');
      }
    },
    { timezone: 'UTC' },
  );

  cron.schedule(
    '0 8 * * *',
    async () => {
      try {
        await runCertExpiryCheck();
      } catch (err) {
        logger.error({ err }, '[Scheduler] CertExpiryCheck failed');
      }
    },
    { timezone: 'UTC' },
  );

  cron.schedule(
    '0 9 * * *',
    async () => {
      try {
        await runMembershipCleanup();
      } catch (err) {
        logger.error({ err }, '[membership-cleanup] sweep failed');
      }
    },
    { timezone: 'UTC' },
  );

  cron.schedule(
    '0 10 * * *',
    async () => {
      if (marketplaceSyncRunning) {
        logger.warn('[Scheduler] marketplace syncAll already running; skipping tick');
        return;
      }
      marketplaceSyncRunning = true;
      try {
        await syncMarketplaceAll();
      } catch (err) {
        logger.error({ err }, '[Scheduler] marketplace syncAll failed');
      } finally {
        marketplaceSyncRunning = false;
      }
    },
    { timezone: 'UTC' },
  );

  logger.info(
    'Scheduler started (pending-notify */5min, approval-reminders 06:00 UTC, silent-consent 07:00 UTC, cert-check 08:00 UTC, membership-cleanup 09:00 UTC, marketplace-sync 10:00 UTC)',
  );
}
