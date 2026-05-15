/**
 * asyncHandler.ts — wraps an async Express route handler.
 *
 * Catches any thrown error, runs it through sanitizeError (whitelisted
 * business codes → safe `{ code, message }`; everything else collapses
 * to `OPERATION_FAILED`), and responds with the supplied status.
 *
 * Use only on routes whose error path is "single status + sanitizeError"
 * — i.e. the contacts / endpoints / memberships / organization template.
 * Routes that need richer dispatch (per-error status code, custom
 * response shape, headers already sent) should keep their own try/catch.
 *
 * If `res.headersSent` is true at the time of the throw (a streaming or
 * partial-write response that then errored), the error is forwarded to
 * the global error handler in app.ts so Express closes the response
 * cleanly instead of attempting a second send.
 *
 * Dependencies: express, sanitizeError
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { sanitizeError } from './sanitizeError';

type AsyncRouteHandler<P, ResBody, ReqBody, ReqQuery> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, string>,
>(
  fn: AsyncRouteHandler<P, ResBody, ReqBody, ReqQuery>,
  status = 400,
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err: unknown) => {
      if (res.headersSent) return next(err);
      res.status(status).json({ error: sanitizeError(err) } as ResBody);
    });
  };
}
