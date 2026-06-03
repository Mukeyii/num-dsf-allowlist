/**
 * time.ts — Shared time constants. Use these instead of inlining arithmetic
 * like `7 * 24 * 60 * 60 * 1000`. Keep them named after what they mean in
 * this codebase (REFRESH_TTL, OTP_TTL, etc.), not generic primitives.
 *
 * Dependencies: none.
 */
export const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const REFRESH_TOKEN_TTL_SEC = 7 * 24 * 60 * 60; // 7 days
export const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_SEC * 1000;
export const OTP_TTL_SEC = 10 * 60; // 10 minutes
export const SITE_NOTIFY_DELAY_MS = 30 * MINUTE_MS; // approval-reminder
export const REMINDER_THROTTLE_MS = 7 * DAY_MS; // approval-reminder
