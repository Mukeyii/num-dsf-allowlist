/**
 * auth.middleware.test.ts — unit coverage for requireAuth (bearer-token gate).
 *
 * requireAuth is exercised directly with hand-rolled req/res/next doubles (it
 * only reads req.headers.authorization and mutates req.user, so a full express
 * mount would add noise without coverage). It verifies the access token with the
 * service's RS256 public key, so a real seeded user is minted via getTestToken.
 *
 *   • a valid Bearer token calls next() once, leaves res untouched, and
 *     populates req.user with { id, email } from the token claims.
 *   • a missing Authorization header → 401 UNAUTHORIZED, next() never called.
 *   • a malformed / garbage Bearer value → 401 UNAUTHORIZED, next() never called.
 *   • a token signed with a foreign RSA key → 401 UNAUTHORIZED, next() never
 *     called (forged with an in-process throwaway key the public key rejects).
 *
 * On the success path the middleware fires a non-blocking Redis activity write
 * (`activity:<sub>`); afterAll deletes that key so the suite leaves no residue.
 *
 * Dependencies: express types, jsonwebtoken, crypto, uuid, db/connection,
 * redis.service, helpers/auth.getTestToken, auth.middleware.
 */
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { redis } from '../services/redis.service';
import { getTestToken } from './helpers/auth';
import { requireAuth } from '../middleware/auth.middleware';

interface ResSpy {
  res: Response;
  statusCode: number | null;
  body: unknown;
}

/** Minimal res double capturing the status/json the middleware emits. */
function makeRes(): ResSpy {
  const spy: ResSpy = { res: {} as Response, statusCode: null, body: undefined };
  const res = {
    status(code: number): Response {
      spy.statusCode = code;
      return res as Response;
    },
    json(payload: unknown): Response {
      spy.body = payload;
      return res as Response;
    },
  };
  spy.res = res as unknown as Response;
  return spy;
}

function makeReq(authorization?: string): Request {
  return { headers: authorization === undefined ? {} : { authorization } } as Request;
}

describe('auth.middleware – requireAuth', () => {
  const userId = uuidv4();
  const email = `auth-mw-${Date.now()}@example.de`;

  beforeAll(async () => {
    await db('email_whitelist').insert({ id: uuidv4(), email, created_at: new Date() });
    await db('users').insert({ id: userId, email, totp_enabled: true, created_at: new Date() });
  });

  afterAll(async () => {
    await redis.del(`activity:${userId}`);
    await db('users').where({ id: userId }).del();
    await db('email_whitelist').where({ email }).del();
  });

  it('accepts a valid Bearer token: calls next() and populates req.user', () => {
    const req = makeReq(`Bearer ${getTestToken(email, userId)}`);
    const spy = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    requireAuth(req, spy.res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(spy.statusCode).toBeNull();
    expect(req.user).toEqual({ id: userId, email });
  });

  it('rejects a missing Authorization header with 401 and never calls next()', () => {
    const req = makeReq(undefined);
    const spy = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    requireAuth(req, spy.res, next);

    expect(next).not.toHaveBeenCalled();
    expect(spy.statusCode).toBe(401);
    expect(spy.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    expect(req.user).toBeUndefined();
  });

  it('rejects a non-Bearer / garbage header with 401', () => {
    const req = makeReq('Basic Zm9vOmJhcg==');
    const spy = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    requireAuth(req, spy.res, next);

    expect(next).not.toHaveBeenCalled();
    expect(spy.statusCode).toBe(401);
    expect(spy.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('rejects a malformed Bearer token with 401', () => {
    const req = makeReq('Bearer not.a.jwt');
    const spy = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    requireAuth(req, spy.res, next);

    expect(next).not.toHaveBeenCalled();
    expect(spy.statusCode).toBe(401);
    expect(spy.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    expect(req.user).toBeUndefined();
  });

  it('rejects a token signed with a foreign RSA key with 401', () => {
    // Throwaway keypair the service public key will not validate against.
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const forged = jwt.sign(
      { sub: userId, email },
      privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
      {
        algorithm: 'RS256',
        expiresIn: '15m',
      },
    );
    const req = makeReq(`Bearer ${forged}`);
    const spy = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    requireAuth(req, spy.res, next);

    expect(next).not.toHaveBeenCalled();
    expect(spy.statusCode).toBe(401);
    expect(spy.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    expect(req.user).toBeUndefined();
  });
});
