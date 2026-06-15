/**
 * getErrorMessage.ts — Pull a human-readable message out of an axios error.
 * The backend wraps failures as `{ error: { code, message, details } }`, so
 * the message lives at `err.response.data.error.message`. Falls back to the
 * supplied default when the shape doesn't match (network error, non-API 500).
 *
 * For validation (400) errors the top-level message is generic ("Invalid
 * input"); the actionable per-field reason lives in `error.details[]` (Zod
 * issues with `path` + `message`). When present, surface the first issue
 * (prefixed with its field path) so the user sees something actionable.
 */
interface ZodIssueLike {
  path?: unknown;
  message?: unknown;
}
interface ApiErrorShape {
  response?: { data?: { error?: { message?: string; details?: unknown } } };
}

export function getErrorMessage(err: unknown, fallback: string): string {
  const error = (err as ApiErrorShape)?.response?.data?.error;
  const baseMessage = error?.message || fallback;

  const details = error?.details;
  if (Array.isArray(details) && details.length > 0) {
    const issue = details[0] as ZodIssueLike;
    const issueMessage = typeof issue?.message === 'string' ? issue.message : '';
    if (issueMessage) {
      const path = Array.isArray(issue.path) ? issue.path.filter(Boolean).join('.') : '';
      return path ? `${path}: ${issueMessage}` : issueMessage;
    }
  }

  return baseMessage;
}
