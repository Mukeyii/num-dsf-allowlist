/**
 * totp.middleware.test.ts — unit-tests the requireFreshTotp step-up guard.
 *
 * The middleware reads req.body.totpCode + req.user.id and delegates the actual
 * check to totp.service.verifyTotpCode. We exercise it against the REAL verify
 * path (encrypted secret in the DB, speakeasy-minted code) with mock
 * req/res/next objects, asserting the 400/401 contract and that next() runs
 * only on a fresh valid code.
 *
 * The DEV_TOTP_BYPASS shortcut is forced OFF here (the dev/test container sets
 * it on, which would short-circuit verifyTotpCode to true for any 6-char code
 * and mask the 401 path) so the genuine decrypt+verify path runs.
 *
 * Dependencies: express types, db/connection, speakeasy, totp.service.
 */
import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import speakeasy from 'speakeasy';
import { db } from '../db/connection';
import { saveTotpSecret } from '../services/totp.service';
import { requireFreshTotp } from '../middleware/totp.middleware';

interface CapturedResponse {
  statusCode: number | null;
  body: unknown;
}

// Minimal Express res double: records status() + json() so we can assert the
// error contract without mounting a full app.
function makeRes(): { res: Response; captured: CapturedResponse } {
  const captured: CapturedResponse = { statusCode: null, body: null };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      captured.body = payload;
      return this;
    },
  } as unknown as Response;
  return { res, captured };
}

function makeReq(userId: string, body: Record<string, unknown>): Request {
  return { user: { id: userId, email: 'guard@example.de' }, body } as unknown as Request;
}

describe('requireFreshTotp middleware', () => {
  const userId = uuidv4();
  const email = `totp-mw-${Date.now()}@example.de`;
  let secret: string;
  let savedAutoLogin: string | undefined;
  let savedBypass: string | undefined;

  beforeAll(async () => {
    // Force the dev bypass off so verifyTotpCode runs the real decrypt+verify
    // instead of short-circuiting to true regardless of the submitted code.
    savedAutoLogin = process.env.DEV_AUTO_LOGIN;
    savedBypass = process.env.DEV_TOTP_BYPASS;
    delete process.env.DEV_AUTO_LOGIN;
    delete process.env.DEV_TOTP_BYPASS;

    await db('users').insert({ id: userId, email, totp_enabled: true, created_at: new Date() });
    secret = speakeasy.generateSecret({ length: 20 }).base32;
    await saveTotpSecret(userId, secret); // AES-256-GCM encrypts into the DB
  });

  afterAll(async () => {
    if (savedAutoLogin === undefined) delete process.env.DEV_AUTO_LOGIN;
    else process.env.DEV_AUTO_LOGIN = savedAutoLogin;
    if (savedBypass === undefined) delete process.env.DEV_TOTP_BYPASS;
    else process.env.DEV_TOTP_BYPASS = savedBypass;
    await db('users').where({ id: userId }).del();
  });

  it('calls next() and writes no response for a fresh valid code', async () => {
    const code = speakeasy.totp({ secret, encoding: 'base32' });
    const req = makeReq(userId, { totpCode: code });
    const { res, captured } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await requireFreshTotp(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(captured.statusCode).toBeNull(); // no status() on success
    expect(captured.body).toBeNull();
  });

  it('rejects a missing code with 400 TOTP_REQUIRED and does not call next()', async () => {
    const req = makeReq(userId, {}); // no totpCode field
    const { res, captured } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await requireFreshTotp(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ error: { code: 'TOTP_REQUIRED' } });
  });

  it('rejects a malformed (wrong-length) code with 400 before hitting the service', async () => {
    const req = makeReq(userId, { totpCode: '123' }); // length !== 6
    const { res, captured } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await requireFreshTotp(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ error: { code: 'TOTP_REQUIRED' } });
  });

  it('rejects a non-string code with 400 (typeof guard)', async () => {
    const req = makeReq(userId, { totpCode: 123456 }); // number, not a string
    const { res, captured } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await requireFreshTotp(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ error: { code: 'TOTP_REQUIRED' } });
  });

  it('rejects a well-formed but wrong code with 401 TOTP_INVALID and does not call next()', async () => {
    // 6 chars so it clears the shape guard, but not the current TOTP step.
    const req = makeReq(userId, { totpCode: '000000' });
    const { res, captured } = makeRes();
    const next = jest.fn() as unknown as NextFunction;

    await requireFreshTotp(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(captured.statusCode).toBe(401);
    expect(captured.body).toMatchObject({ error: { code: 'TOTP_INVALID' } });
  });
});
