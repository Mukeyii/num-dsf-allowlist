/**
 * asyncHandler.test.ts — pure tests for the async route wrapper. No DB.
 * Uses mock req/res/next to confirm success passes through, thrown business
 * errors become a sanitized JSON response, and a post-headers error is
 * forwarded to the global handler instead of double-sending.
 */
import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../lib/asyncHandler';

function mockRes(headersSent = false) {
  const res = {
    headersSent,
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe('asyncHandler', () => {
  it('does not touch the response when the handler resolves', async () => {
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;
    const handler = asyncHandler(async () => {
      /* success */
    });
    await handler({} as any, res as any, next);
    expect(res.statusCode).toBe(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds with the configured status and a sanitized error on throw', async () => {
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;
    const handler = asyncHandler(async () => {
      throw new Error('CONTACT_NOT_FOUND');
    }, 404);
    await handler({} as any, res as any, next);
    // allow the .catch microtask to run
    await new Promise((r) => setImmediate(r));
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'CONTACT_NOT_FOUND', message: 'CONTACT_NOT_FOUND' },
    });
  });

  it('forwards to next when headers were already sent', async () => {
    const res = mockRes(true);
    const next = jest.fn() as unknown as NextFunction;
    const handler = asyncHandler(async () => {
      throw new Error('boom');
    });
    await handler({} as any, res as any, next);
    await new Promise((r) => setImmediate(r));
    expect(next).toHaveBeenCalledTimes(1);
  });
});
