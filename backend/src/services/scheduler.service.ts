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

export function startScheduler(): void {
  cron.schedule('*/5 * * * *', async () => {
    try { await flushPendingNotifications(); }
    catch (err) { console.error('[Scheduler] flushPendingNotifications failed:', err); }
  }, { timezone: 'UTC' });

  cron.schedule('0 6 * * *', async () => {
    try { await runApprovalReminders(); }
    catch (err) { console.error('[Scheduler] ApprovalReminders failed:', err); }
  }, { timezone: 'UTC' });

  cron.schedule('0 7 * * *', async () => {
    try {
      const n = await runSilentConsentSweep();
      if (n > 0) console.log(`[silent-consent] promoted ${n} request(s)`);
    } catch (err) {
      console.error('[silent-consent] sweep failed', err);
    }
  }, { timezone: 'UTC' });

  cron.schedule('0 8 * * *', async () => {
    try { await runCertExpiryCheck(); }
    catch (err) { console.error('[Scheduler] CertExpiryCheck failed:', err); }
  }, { timezone: 'UTC' });

  cron.schedule('0 9 * * *', async () => {
    try {
      await runMembershipCleanup();
    } catch (err) {
      console.error('[membership-cleanup] sweep failed', err);
    }
  }, { timezone: 'UTC' });

  cron.schedule('0 10 * * *', async () => {
    try { await syncMarketplaceAll(); }
    catch (err) { console.error('[Scheduler] marketplace syncAll failed:', err); }
  }, { timezone: 'UTC' });

  console.log('✓ Scheduler started (pending-notify */5min, approval-reminders 06:00 UTC, silent-consent 07:00 UTC, cert-check 08:00 UTC, membership-cleanup 09:00 UTC, marketplace-sync 10:00 UTC)');
}
