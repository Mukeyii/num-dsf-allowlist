/**
 * isDevEnv.ts – Positive allowlist for development/test environments.
 * Used to gate dev-only shortcuts (dev-login, TOTP bypass) so that an
 * unrecognized NODE_ENV (e.g. 'staging') never falls into the dev path the
 * way a `!== 'production'` denylist would. Only 'development' and 'test'
 * are treated as dev.
 */
export function isDevEnv(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}
