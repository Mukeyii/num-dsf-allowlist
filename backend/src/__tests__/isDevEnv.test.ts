/**
 * isDevEnv.test.ts — pure tests for the dev-environment allowlist. Only
 * 'development' and 'test' count as dev; every other NODE_ENV (including
 * undefined and 'staging') is non-dev. This is a positive allowlist, NOT a
 * `!== 'production'` denylist, so an unrecognized value must never fall into
 * the dev path. Saves/restores process.env.NODE_ENV. No DB.
 */
import { isDevEnv } from '../lib/isDevEnv';

describe('isDevEnv', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
  });

  it('is true for development', () => {
    process.env.NODE_ENV = 'development';
    expect(isDevEnv()).toBe(true);
  });

  it('is true for test', () => {
    process.env.NODE_ENV = 'test';
    expect(isDevEnv()).toBe(true);
  });

  it('is false for production', () => {
    process.env.NODE_ENV = 'production';
    expect(isDevEnv()).toBe(false);
  });

  it('is false for an unrecognized environment like staging', () => {
    process.env.NODE_ENV = 'staging';
    expect(isDevEnv()).toBe(false);
  });

  it('is false when NODE_ENV is undefined', () => {
    delete process.env.NODE_ENV;
    expect(isDevEnv()).toBe(false);
  });

  it('is false for an empty string (not on the allowlist)', () => {
    process.env.NODE_ENV = '';
    expect(isDevEnv()).toBe(false);
  });
});
