/**
 * dateUtils.ts – Shared date utility functions.
 */

/** Calculate days remaining until a date string. Negative values = past. */
export function daysUntil(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
}
