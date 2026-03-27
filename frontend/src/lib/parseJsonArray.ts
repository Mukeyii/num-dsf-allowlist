/**
 * Safely parse a JSON array field that might be:
 * - already an array (MySQL JSON type parsed by driver)
 * - a JSON string '["A","B"]'
 * - a plain comma-separated string "A,B"
 * - null/undefined
 */
export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  const str = String(value);
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [str];
  } catch {
    return str.split(',').map(s => s.trim()).filter(Boolean);
  }
}
