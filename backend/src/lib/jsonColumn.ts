/**
 * jsonColumn.ts – Defensive reader for a Knex JSON column that should hold a
 * string array (e.g. roles, contact types, marketplace topics).
 *
 * MySQL/Knex returns JSON columns as already-parsed JS values in most setups,
 * but tests and older drivers can hand back the raw string. A malformed value
 * (hand-edited row, legacy NULL, non-array JSON) degrades to [] rather than
 * throwing. Non-string elements are dropped.
 */
export function parseJsonStringArray(value: unknown): string[] {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) {
      return parsed.filter((x: unknown): x is string => typeof x === 'string');
    }
  } catch {
    /* fall through to [] */
  }
  return [];
}
