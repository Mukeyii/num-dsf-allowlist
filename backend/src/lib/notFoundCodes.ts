/**
 * notFoundCodes.ts – Single source of truth for error messages that map to
 * HTTP 404. Shared by the global error handler in app.ts and asyncHandler,
 * so a thrown `*_NOT_FOUND` business error surfaces as 404 rather than 400.
 *
 * Exact equality only — a service throwing 'WHATEVER_NOT_FOUND' does not
 * collide with the handler. Add new codes here explicitly when they appear.
 */
export const NOT_FOUND_CODES = new Set([
  'NOT_FOUND',
  'ORGANIZATION_NOT_FOUND',
  'CONTACT_NOT_FOUND',
  'ENDPOINT_NOT_FOUND',
  'MEMBERSHIP_NOT_FOUND',
  'CERTIFICATE_NOT_FOUND',
  'REQUEST_NOT_FOUND',
  'USER_NOT_FOUND',
]);
