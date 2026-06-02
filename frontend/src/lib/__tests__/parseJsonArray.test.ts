/**
 * parseJsonArray.test.ts — pure tests for the tolerant JSON-array parser that
 * normalizes the several shapes a MySQL JSON column can surface as.
 */
import { describe, it, expect } from 'vitest';
import { parseJsonArray } from '../parseJsonArray';

describe('parseJsonArray', () => {
  it('returns an already-parsed array unchanged', () => {
    expect(parseJsonArray(['DIC', 'HRP'])).toEqual(['DIC', 'HRP']);
  });

  it('parses a JSON-array string', () => {
    expect(parseJsonArray('["DIC","DMS"]')).toEqual(['DIC', 'DMS']);
  });

  it('splits a plain comma-separated string and trims', () => {
    expect(parseJsonArray('DIC, HRP , DMS')).toEqual(['DIC', 'HRP', 'DMS']);
  });

  it('wraps a non-array JSON value as a single-element array of the raw input', () => {
    // JSON.parse succeeds but yields a non-array, so the original string is
    // returned wrapped — not the parsed scalar.
    expect(parseJsonArray('42')).toEqual(['42']);
  });

  it('returns an empty array for null/undefined/empty', () => {
    expect(parseJsonArray(null)).toEqual([]);
    expect(parseJsonArray(undefined)).toEqual([]);
    expect(parseJsonArray('')).toEqual([]);
  });

  it('drops empty fragments from a comma string', () => {
    expect(parseJsonArray('DIC,,HRP,')).toEqual(['DIC', 'HRP']);
  });
});
