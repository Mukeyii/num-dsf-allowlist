/**
 * sanitizeError.ts – Sanitize error messages for API responses
 * Prevents leaking internal error details to clients.
 * Only whitelisted business error codes are passed through.
 */

const KNOWN_ERROR_CODES = new Set([
  'NOT_FOUND',
  'ALREADY_EXISTS',
  'PRIVATE_KEY_REJECTED',
  'INVALID_STATUS',
  'REQUEST_NOT_FOUND',
  'ALREADY_RESOLVED',
  'INVALID_TOTP',
  'INVALID_OTP',
  'NOT_WHITELISTED',
  'USER_NOT_FOUND',
  'TOTP_NOT_INITIALIZED',
  'INVALID_TOKEN_PURPOSE',
  'INVALID_TOTP_CODE',
  'INVALID_REFRESH_TOKEN',
  'CONFLICT',
  'ENDPOINT_NOT_FOUND',
  'CONTACT_NOT_FOUND',
  'MEMBERSHIP_NOT_FOUND',
  'ORGANIZATION_NOT_FOUND',
  'CERTIFICATE_NOT_FOUND',
  'INVALID_TYPE',
  'INVALID_ROLES',
  'APPROVAL_ALREADY_PENDING',
  'ALREADY_DECIDED',
  'IDENTIFIER_IMMUTABLE',
  'CA_BLACKLISTED',
  'INVALID_PEM',
  'BUNDLE_CORRUPT',
]);

export function sanitizeError(err: any): { code: string; message: string } {
  const msg = err?.message || '';
  if (KNOWN_ERROR_CODES.has(msg)) {
    return { code: msg, message: msg };
  }
  return { code: 'OPERATION_FAILED', message: 'Operation failed' };
}
