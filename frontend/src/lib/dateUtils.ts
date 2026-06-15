/**
 * dateUtils.ts – Shared date utility functions.
 */

/** Calculate days remaining until a date string. Negative values = past. */
export function daysUntil(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

type RelTimeKey = 'relJustNow' | 'relAgoMinutes' | 'relAgoHours' | 'relAgoDays';

/**
 * Localized relative time ("just now", "{n}m ago", ...). `t` is the i18n
 * translator; only the rel* keys are used, so the param type is narrowed to
 * keep this a leaf module (no store import). The `{n}` substitution matches the
 * translator's own params handling exactly, so output is identical either way.
 */
export function relTime(
  dateStr: string,
  t: (key: RelTimeKey, params?: Record<string, string | number>) => string,
): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return t('relJustNow');
  if (diff < 3600) return t('relAgoMinutes', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('relAgoHours', { n: Math.floor(diff / 3600) });
  return t('relAgoDays', { n: Math.floor(diff / 86400) });
}
