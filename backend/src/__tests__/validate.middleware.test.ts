/**
 * validate.middleware.test.ts — unit tests for the zod-validation middleware.
 * No DB/Redis: the middleware only wraps a ZodSchema and reads/writes
 * req.body/req.query, so it is exercised directly with mock req/res/next.
 *
 * Covers:
 *  - valid body → next() called, no response written, req.body left as the
 *    parsed (coerced) value
 *  - invalid body → 400 with { error: { code, message, details } } and next()
 *    NOT called
 *  - default source is 'body'; query source mutates req.query in place
 *
 * Dependencies: zod, express types, ../middleware/validate.middleware
 */
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';

interface Captured {
  statusCode: number | undefined;
  body: unknown;
}

// Minimal mock Response capturing status()/json() while supporting chaining.
// Returns the live `captured` object so tests read it AFTER invoking the
// middleware (do not destructure its fields before the call).
function mockRes(): { res: Response; captured: Captured } {
  const captured: Captured = { statusCode: undefined, body: undefined };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this as unknown as Response;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this as unknown as Response;
    },
  } as unknown as Response;
  return { res, captured };
}

interface ErrorShape {
  error: { code: string; message: string; details: unknown };
}

describe('validate middleware', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.coerce.number().int().min(0),
  });

  it('calls next() and writes no response for a valid body', () => {
    const req = { body: { name: 'Alice', age: 30 } } as Request;
    const { res, captured } = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(captured.statusCode).toBeUndefined();
    expect(captured.body).toBeUndefined();
  });

  it('leaves the parsed (coerced) value on req.body', () => {
    const req = { body: { name: 'Bob', age: '42' } } as Request;
    const { res } = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    validate(schema)(req, res, next);

    // z.coerce.number() turns the string into a number on the parsed output.
    expect(req.body).toEqual({ name: 'Bob', age: 42 });
    expect(typeof (req.body as { age: unknown }).age).toBe('number');
  });

  it('responds 400 with the field-detail error shape and does NOT call next on an invalid body', () => {
    const req = { body: { name: '', age: -1 } } as Request;
    const { res, captured } = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    validate(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(400);

    const payload = captured.body as ErrorShape;
    expect(payload.error.code).toBe('VALIDATION');
    expect(payload.error.message).toBe('Invalid input');
    expect(Array.isArray(payload.error.details)).toBe(true);

    const detail = payload.error.details as Array<{ path: (string | number)[] }>;
    // Every reported issue carries a field path pointing at the offending key.
    expect(detail.length).toBeGreaterThan(0);
    const paths = detail.map((d) => d.path[0]);
    expect(paths).toContain('name');
    expect(paths).toContain('age');
  });

  it('rejects a missing required field with 400 and a path-bearing detail', () => {
    const req = { body: { age: 1 } } as Request; // name missing
    const { res, captured } = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    validate(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(400);
    const payload = captured.body as ErrorShape;
    const detail = payload.error.details as Array<{ path: (string | number)[] }>;
    expect(detail.some((d) => d.path[0] === 'name')).toBe(true);
  });

  it("defaults to the 'body' source when none is given", () => {
    const validateBody = validate(schema); // no explicit source
    const req = { body: { name: 'Carol', age: 5 }, query: {} } as unknown as Request;
    const { res } = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    validateBody(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ name: 'Carol', age: 5 });
  });

  it("validates and rewrites req.query in place when source is 'query'", () => {
    const querySchema = z.object({ page: z.coerce.number().int().min(1) });
    // raw query values arrive as strings; keep a stale extra key to prove the
    // middleware clears the existing object before assigning parsed data.
    const query: Record<string, unknown> = { page: '3', stale: 'remove-me' };
    const req = { query } as unknown as Request;
    const { res, captured } = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    validate(querySchema, 'query')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(captured.statusCode).toBeUndefined();
    expect(req.query).toEqual({ page: 3 });
    // mutated the SAME object reference rather than replacing it.
    expect(req.query).toBe(query);
    expect((req.query as Record<string, unknown>).stale).toBeUndefined();
  });

  it("responds 400 for an invalid query and does NOT call next when source is 'query'", () => {
    const querySchema = z.object({ page: z.coerce.number().int().min(1) });
    const req = { query: { page: '0' } } as unknown as Request;
    const { res, captured } = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    validate(querySchema, 'query')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(400);
    expect((captured.body as ErrorShape).error.code).toBe('VALIDATION');
  });
});
