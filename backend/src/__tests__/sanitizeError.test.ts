/**
 * sanitizeError.test.ts — pure tests for the error-sanitizer. No DB. Confirms
 * whitelisted business codes pass through and anything else collapses to a
 * generic message so internal details never reach the client.
 */
import { sanitizeError } from '../lib/sanitizeError';

describe('sanitizeError', () => {
  it('passes a whitelisted business code through unchanged', () => {
    expect(sanitizeError(new Error('CA_BLACKLISTED'))).toEqual({
      code: 'CA_BLACKLISTED',
      message: 'CA_BLACKLISTED',
    });
  });

  it('collapses an unknown error message to OPERATION_FAILED', () => {
    expect(sanitizeError(new Error('ER_DUP_ENTRY: duplicate key 42'))).toEqual({
      code: 'OPERATION_FAILED',
      message: 'Operation failed',
    });
  });

  it('collapses an error with no message', () => {
    expect(sanitizeError(new Error())).toEqual({
      code: 'OPERATION_FAILED',
      message: 'Operation failed',
    });
  });

  it('handles a null/undefined error without throwing', () => {
    expect(sanitizeError(null)).toEqual({ code: 'OPERATION_FAILED', message: 'Operation failed' });
    expect(sanitizeError(undefined)).toEqual({ code: 'OPERATION_FAILED', message: 'Operation failed' });
  });

  it('does not leak a raw SQL or stack string', () => {
    const result = sanitizeError(new Error('select * from users where id = 1'));
    expect(result.message).toBe('Operation failed');
  });
});
