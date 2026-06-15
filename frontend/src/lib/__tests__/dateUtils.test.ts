/**
 * dateUtils.test.ts — pure tests for daysUntil. Uses fake timers so "now" is
 * fixed and the arithmetic is deterministic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { daysUntil, relTime } from '../dateUtils';

// Mirrors the en.ts strings + the i18n store's {n} substitution so the test
// asserts the real rendered output, not just which key was picked.
const EN: Record<string, string> = {
  relJustNow: 'just now',
  relAgoMinutes: '{n}m ago',
  relAgoHours: '{n}h ago',
  relAgoDays: '{n}d ago',
};
const t = (key: string, params?: Record<string, string | number>): string => {
  let str = EN[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) str = str.replace(`{${k}}`, String(v));
  return str;
};

describe('daysUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a positive count for a future date', () => {
    expect(daysUntil('2026-01-11T00:00:00Z')).toBe(10);
  });

  it('returns a negative count for a past date', () => {
    expect(daysUntil('2025-12-22T00:00:00Z')).toBe(-10);
  });

  it('returns 0 on the same day', () => {
    expect(daysUntil('2026-01-01T12:00:00Z')).toBe(0);
  });
});

describe('relTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders "just now" under a minute', () => {
    expect(relTime('2026-01-01T11:59:30Z', t)).toBe('just now');
  });

  it('renders minutes ago', () => {
    expect(relTime('2026-01-01T11:55:00Z', t)).toBe('5m ago');
  });

  it('renders hours ago', () => {
    expect(relTime('2026-01-01T09:00:00Z', t)).toBe('3h ago');
  });

  it('renders days ago', () => {
    expect(relTime('2025-12-30T12:00:00Z', t)).toBe('2d ago');
  });
});
