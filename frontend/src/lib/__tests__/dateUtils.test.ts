/**
 * dateUtils.test.ts — pure tests for daysUntil. Uses fake timers so "now" is
 * fixed and the arithmetic is deterministic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { daysUntil } from '../dateUtils';

describe('daysUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

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
