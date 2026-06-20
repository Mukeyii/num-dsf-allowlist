/**
 * errMessage.ts – Narrowing helpers for `catch (err: unknown)` blocks.
 * errMessage reads a thrown value's message; errCode reads a driver error code
 * (e.g. MySQL 'ER_DUP_ENTRY'). Both return '' when the property is absent,
 * letting call sites compare without an `any`-typed catch binding.
 */
export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : '';
}

export function errCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return '';
}
