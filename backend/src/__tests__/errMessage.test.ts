/**
 * errMessage.test.ts — pure tests for the catch-block narrowing helpers.
 * errMessage extracts an Error's .message (and '' for anything that is not an
 * Error); errCode extracts a string .code (e.g. a MySQL driver code) and ''
 * when the property is absent or not a string. No DB.
 */
import { errMessage, errCode } from '../lib/errMessage';

describe('errMessage', () => {
  it('returns the message of an Error', () => {
    expect(errMessage(new Error('boom'))).toBe('boom');
  });

  it('returns the message of an Error subclass', () => {
    expect(errMessage(new TypeError('bad type'))).toBe('bad type');
  });

  it('returns empty string for an empty Error', () => {
    expect(errMessage(new Error())).toBe('');
  });

  it('returns empty string for a bare string (not an Error instance)', () => {
    expect(errMessage('not an error')).toBe('');
  });

  it('returns empty string for null/undefined', () => {
    expect(errMessage(null)).toBe('');
    expect(errMessage(undefined)).toBe('');
  });

  it('returns empty string for a plain object that merely has a message field', () => {
    expect(errMessage({ message: 'looks like an error' })).toBe('');
  });
});

describe('errCode', () => {
  it('extracts a string code from a driver-style error object', () => {
    expect(errCode({ code: 'ER_DUP_ENTRY' })).toBe('ER_DUP_ENTRY');
  });

  it('extracts code from an Error decorated with a code property', () => {
    const err = Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
    expect(errCode(err)).toBe('ER_DUP_ENTRY');
  });

  it('returns empty string when code is present but not a string', () => {
    expect(errCode({ code: 1062 })).toBe('');
  });

  it('returns empty string when the code property is absent', () => {
    expect(errCode({ message: 'no code here' })).toBe('');
    expect(errCode(new Error('plain'))).toBe('');
  });

  it('returns empty string for null/undefined/primitive values', () => {
    expect(errCode(null)).toBe('');
    expect(errCode(undefined)).toBe('');
    expect(errCode('ER_DUP_ENTRY')).toBe('');
    expect(errCode(42)).toBe('');
  });
});
