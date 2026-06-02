/**
 * getErrorMessage.ts — Pull a human-readable message out of an axios error.
 * The backend wraps failures as `{ error: { code, message, details } }`, so
 * the message lives at `err.response.data.error.message`. Falls back to the
 * supplied default when the shape doesn't match (network error, non-API 500).
 */
interface ApiErrorShape {
  response?: { data?: { error?: { message?: string } } };
}

export function getErrorMessage(err: unknown, fallback: string): string {
  return (err as ApiErrorShape)?.response?.data?.error?.message || fallback;
}
