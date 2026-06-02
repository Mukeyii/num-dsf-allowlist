/**
 * scheduler.test.ts — verifies startScheduler registers exactly the six cron
 * jobs on the expected expressions. node-cron is mocked so nothing actually
 * runs; a typo in a cron expression (e.g. '* 6 * * *' instead of '0 6 * * *')
 * would flood admins in production, so the schedule strings are asserted.
 */
const scheduleMock = jest.fn();
jest.mock('node-cron', () => ({ __esModule: true, default: { schedule: scheduleMock } }));

// adminGrants.ts (transitively imported via approval-reminder) decodes a
// signing key at module load. Provide a dummy so the import chain resolves —
// the key is never used here because the test only registers handlers, it
// never runs them. CI sets real keys, so the ||= keeps those.
process.env.JWT_PRIVATE_KEY_BASE64 ||= Buffer.from('dummy-key').toString('base64');
process.env.JWT_PUBLIC_KEY_BASE64 ||= Buffer.from('dummy-key').toString('base64');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { startScheduler } = require('../services/scheduler.service') as typeof import('../services/scheduler.service');

describe('startScheduler', () => {
  beforeEach(() => scheduleMock.mockClear());

  it('registers six cron jobs', () => {
    startScheduler();
    expect(scheduleMock).toHaveBeenCalledTimes(6);
  });

  it('uses the documented schedule for each job', () => {
    startScheduler();
    const expressions = scheduleMock.mock.calls.map((c) => c[0]);
    expect(expressions).toEqual([
      '*/5 * * * *', // flush pending notifications
      '0 6 * * *',   // approval reminders
      '0 7 * * *',   // silent consent sweep
      '0 8 * * *',   // cert expiry check
      '0 9 * * *',   // membership cleanup
      '0 10 * * *',  // marketplace sync
    ]);
  });

  it('schedules every job in the UTC timezone', () => {
    startScheduler();
    for (const call of scheduleMock.mock.calls) {
      expect(call[2]).toEqual({ timezone: 'UTC' });
    }
  });
});
