/**
 * jsonColumn.test.ts — pure tests for parseJsonStringArray, the defensive
 * reader for Knex JSON string-array columns. Parses a JSON string, passes an
 * already-parsed array through, drops non-string elements, and degrades to []
 * for null/invalid-JSON/non-array input rather than throwing. No DB.
 */
import { parseJsonStringArray } from '../lib/jsonColumn';

describe('parseJsonStringArray', () => {
  it('parses a JSON string array', () => {
    expect(parseJsonStringArray('["DIC","HRP"]')).toEqual(['DIC', 'HRP']);
  });

  it('passes an already-parsed array through unchanged', () => {
    expect(parseJsonStringArray(['MEDIC', 'DSF_ADMIN'])).toEqual(['MEDIC', 'DSF_ADMIN']);
  });

  it('filters out non-string elements from a parsed string', () => {
    expect(parseJsonStringArray('["a",1,null,true,"b"]')).toEqual(['a', 'b']);
  });

  it('filters out non-string elements from an already-parsed array', () => {
    expect(parseJsonStringArray(['a', 2, undefined, {}, 'b'])).toEqual(['a', 'b']);
  });

  it('returns [] for null and undefined', () => {
    expect(parseJsonStringArray(null)).toEqual([]);
    expect(parseJsonStringArray(undefined)).toEqual([]);
  });

  it('returns [] for an empty string (falsy short-circuit)', () => {
    expect(parseJsonStringArray('')).toEqual([]);
  });

  it('returns [] for invalid JSON', () => {
    expect(parseJsonStringArray('{not valid json')).toEqual([]);
  });

  it('returns [] for JSON that is not an array', () => {
    expect(parseJsonStringArray('{"a":1}')).toEqual([]);
    expect(parseJsonStringArray('"a string"')).toEqual([]);
    expect(parseJsonStringArray('42')).toEqual([]);
  });

  it('returns [] for a non-array already-parsed object', () => {
    expect(parseJsonStringArray({ a: 1 })).toEqual([]);
  });

  it('returns an empty array for an empty JSON array', () => {
    expect(parseJsonStringArray('[]')).toEqual([]);
  });
});
