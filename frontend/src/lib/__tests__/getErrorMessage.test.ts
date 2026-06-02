/**
 * getErrorMessage.test.ts — pure unit tests for the axios-error message
 * extractor. No network. Confirms the API-envelope path is read and the
 * fallback is used for every non-matching shape.
 */
import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../getErrorMessage';

describe('getErrorMessage', () => {
  it('returns the API error message when present', () => {
    const err = { response: { data: { error: { message: 'Email already whitelisted' } } } };
    expect(getErrorMessage(err, 'fallback')).toBe('Email already whitelisted');
  });

  it('falls back when the error envelope is absent', () => {
    expect(getErrorMessage(new Error('network down'), 'fallback')).toBe('fallback');
  });

  it('falls back on a partial envelope', () => {
    expect(getErrorMessage({ response: { data: {} } }, 'fallback')).toBe('fallback');
  });

  it('falls back when the message is an empty string', () => {
    const err = { response: { data: { error: { message: '' } } } };
    expect(getErrorMessage(err, 'fallback')).toBe('fallback');
  });

  it('falls back for null / undefined', () => {
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getErrorMessage(undefined, 'fallback')).toBe('fallback');
  });
});
