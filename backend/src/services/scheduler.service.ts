/**
 * scheduler.service.ts – Cron job management
 * Daily 08:00 UTC: cert expiry check
 * Daily 06:00 UTC: approval reminders
 */
import cron from 'node-cron';
import { runCertExpiryCheck } from './cert-monitor.service';
import { runApprovalReminders } from './approval-reminder.service';

export function startScheduler(): void {
  cron.schedule('0 8 * * *', async () => {
    try { await runCertExpiryCheck(); }
    catch (err) { console.error('[Scheduler] CertExpiryCheck failed:', err); }
  }, { timezone: 'UTC' });

  cron.schedule('0 6 * * *', async () => {
    try { await runApprovalReminders(); }
    catch (err) { console.error('[Scheduler] ApprovalReminders failed:', err); }
  }, { timezone: 'UTC' });

  console.log('✓ Scheduler started (cert-check 08:00 UTC, approval-reminders 06:00 UTC)');
}
