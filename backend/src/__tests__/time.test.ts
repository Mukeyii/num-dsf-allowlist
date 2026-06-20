/**
 * time.test.ts — pure tests for the shared time constants. These guard the
 * arithmetic relationships (a typo turning 7 days into 70 would silently
 * lengthen refresh-token lifetime or reminder throttling). No DB.
 */
import {
  SECOND_MS,
  MINUTE_MS,
  HOUR_MS,
  DAY_MS,
  REFRESH_TOKEN_TTL_SEC,
  REFRESH_TOKEN_TTL_MS,
  OTP_TTL_SEC,
  SITE_NOTIFY_DELAY_MS,
  REMINDER_THROTTLE_MS,
} from '../lib/time';

describe('time constants', () => {
  it('builds the millisecond ladder from SECOND_MS', () => {
    expect(SECOND_MS).toBe(1000);
    expect(MINUTE_MS).toBe(60 * SECOND_MS);
    expect(HOUR_MS).toBe(60 * MINUTE_MS);
    expect(DAY_MS).toBe(24 * HOUR_MS);
  });

  it('has a 7-day refresh-token TTL in seconds and the matching ms value', () => {
    expect(REFRESH_TOKEN_TTL_SEC).toBe(7 * 24 * 60 * 60);
    expect(REFRESH_TOKEN_TTL_MS).toBe(REFRESH_TOKEN_TTL_SEC * 1000);
    expect(REFRESH_TOKEN_TTL_MS).toBe(7 * DAY_MS);
  });

  it('has a 10-minute OTP TTL in seconds', () => {
    expect(OTP_TTL_SEC).toBe(10 * 60);
  });

  it('delays the approval notification by 30 minutes', () => {
    expect(SITE_NOTIFY_DELAY_MS).toBe(30 * MINUTE_MS);
  });

  it('throttles approval reminders to once every 7 days', () => {
    expect(REMINDER_THROTTLE_MS).toBe(7 * DAY_MS);
  });
});
