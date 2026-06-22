/**
 * scheduler-callbacks.test.ts — exercises the *bodies* of the cron jobs that
 * startScheduler registers (the sibling scheduler.test.ts only asserts the cron
 * expressions/timezone, never invokes the callbacks).
 *
 * node-cron is mocked so cron.schedule is a spy that captures each registered
 * callback; the six underlying service deps are mocked so the callbacks call
 * into spies with no DB or mail. Asserts:
 *   • each scheduled callback invokes the service it is meant to drive
 *   • a thrown service error is swallowed (logged, not propagated)
 *   • the marketplace overlap guard drops a second tick while the first sweep
 *     is still in-flight, and allows a fresh tick once it settles
 *
 * No DB is needed: every job body's dependency is mocked.
 * Dependencies: node-cron (mocked), the six job-body services (mocked), logger.
 */

// Mocks are hoisted above the (lazy) require of the scheduler module.
type CronCb = () => void | Promise<void>;
type CronOpts = { timezone?: string };
const cbScheduleMock = jest.fn<void, [string, CronCb, CronOpts?]>();
jest.mock('node-cron', () => ({ __esModule: true, default: { schedule: cbScheduleMock } }));

const flushPendingNotifications = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
const runApprovalReminders = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
const runSilentConsentSweep = jest.fn<Promise<number>, []>().mockResolvedValue(0);
const runCertExpiryCheck = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
const runMembershipCleanup = jest.fn<Promise<number>, []>().mockResolvedValue(0);
const syncMarketplaceAll = jest
  .fn<Promise<{ ok: number; failed: number; rateLimited: boolean }>, []>()
  .mockResolvedValue({ ok: 0, failed: 0, rateLimited: false });

jest.mock('../services/approval-reminder.service', () => ({
  flushPendingNotifications,
  runApprovalReminders,
}));
jest.mock('../services/approval-silent-consent.service', () => ({ runSilentConsentSweep }));
jest.mock('../services/cert-monitor.service', () => ({ runCertExpiryCheck }));
jest.mock('../services/membership-cleanup.service', () => ({ runMembershipCleanup }));
jest.mock('../services/marketplace-sync.service', () => ({ syncAll: syncMarketplaceAll }));

const warn = jest.fn();
const error = jest.fn();
jest.mock('../lib/logger', () => ({
  logger: { info: jest.fn(), warn, error },
}));

/**
 * Fresh-load the scheduler so the module-level `marketplaceSyncRunning` guard
 * starts un-set for each test, register the jobs, and return a lookup from cron
 * expression → the callback that startScheduler handed to cron.schedule.
 */
function loadAndRegister(): Map<string, CronCb> {
  cbScheduleMock.mockClear();
  let startScheduler!: () => void;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    startScheduler = (
      require('../services/scheduler.service') as typeof import('../services/scheduler.service')
    ).startScheduler;
  });
  startScheduler();
  const byExpr = new Map<string, CronCb>();
  for (const [expr, cb] of cbScheduleMock.mock.calls) byExpr.set(expr, cb);
  return byExpr;
}

beforeEach(() => {
  flushPendingNotifications.mockClear().mockResolvedValue(undefined);
  runApprovalReminders.mockClear().mockResolvedValue(undefined);
  runSilentConsentSweep.mockClear().mockResolvedValue(0);
  runCertExpiryCheck.mockClear().mockResolvedValue(undefined);
  runMembershipCleanup.mockClear().mockResolvedValue(0);
  syncMarketplaceAll.mockClear().mockResolvedValue({ ok: 0, failed: 0, rateLimited: false });
  warn.mockClear();
  error.mockClear();
});

describe('scheduler job callbacks drive their services', () => {
  it('the */5min job flushes pending notifications', async () => {
    const jobs = loadAndRegister();
    await jobs.get('*/5 * * * *')!();
    expect(flushPendingNotifications).toHaveBeenCalledTimes(1);
  });

  it('the 06:00 job runs approval reminders', async () => {
    const jobs = loadAndRegister();
    await jobs.get('0 6 * * *')!();
    expect(runApprovalReminders).toHaveBeenCalledTimes(1);
  });

  it('the 07:00 job runs the silent-consent sweep', async () => {
    const jobs = loadAndRegister();
    await jobs.get('0 7 * * *')!();
    expect(runSilentConsentSweep).toHaveBeenCalledTimes(1);
  });

  it('the 08:00 job runs the cert expiry check', async () => {
    const jobs = loadAndRegister();
    await jobs.get('0 8 * * *')!();
    expect(runCertExpiryCheck).toHaveBeenCalledTimes(1);
  });

  it('the 09:00 job runs membership cleanup', async () => {
    const jobs = loadAndRegister();
    await jobs.get('0 9 * * *')!();
    expect(runMembershipCleanup).toHaveBeenCalledTimes(1);
  });

  it('the 10:00 job runs the marketplace sync', async () => {
    const jobs = loadAndRegister();
    await jobs.get('0 10 * * *')!();
    expect(syncMarketplaceAll).toHaveBeenCalledTimes(1);
  });
});

describe('scheduler job callbacks swallow service errors', () => {
  it('a failing flush is caught and logged, not thrown', async () => {
    const jobs = loadAndRegister();
    flushPendingNotifications.mockRejectedValueOnce(new Error('boom'));
    await expect(jobs.get('*/5 * * * *')!()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('a failing marketplace sweep is caught and clears the overlap guard', async () => {
    const jobs = loadAndRegister();
    syncMarketplaceAll.mockRejectedValueOnce(new Error('boom'));
    await expect(jobs.get('0 10 * * *')!()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);

    // Guard must be released in `finally`, so the very next tick runs again.
    await jobs.get('0 10 * * *')!();
    expect(syncMarketplaceAll).toHaveBeenCalledTimes(2);
  });
});

describe('marketplace overlap guard', () => {
  it('drops a second tick while the first sweep is still in-flight', async () => {
    const jobs = loadAndRegister();
    const marketplaceJob = jobs.get('0 10 * * *')!;

    // Make the first sweep hang on a promise we resolve by hand, so the guard
    // stays set across the second tick.
    let release!: () => void;
    syncMarketplaceAll.mockReturnValueOnce(
      new Promise((res) => {
        release = () => res({ ok: 1, failed: 0, rateLimited: false });
      }),
    );

    const first = marketplaceJob(); // starts the sweep, guard now set
    await Promise.resolve(); // let the async body reach the awaited syncAll

    await marketplaceJob(); // second tick: must be dropped by the guard
    expect(syncMarketplaceAll).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/already running/i);

    release();
    await first; // first sweep settles → guard released in finally

    // A later tick is allowed through again.
    await marketplaceJob();
    expect(syncMarketplaceAll).toHaveBeenCalledTimes(2);
  });
});
