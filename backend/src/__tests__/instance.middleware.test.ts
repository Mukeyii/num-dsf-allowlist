/**
 * instance.middleware.test.ts – unit test for requireInstanceOwnership.
 *
 * The guard reads req.params.id (or instanceId) and req.user, asks the DB-backed
 * isAdminEmail check whether the caller is an IMI admin, then looks the instance
 * up in the `instances` table scoped to the caller (admins skip the user filter).
 * On success it injects req.instance and calls next(); otherwise it writes a JSON
 * error response and returns without calling next().
 *
 * This suite drives the middleware directly with mock req/res/next objects and
 * real DB rows. Two unique non-admin users each own a unique instance, so we can
 * assert: owner passes, non-owner is rejected, and an unknown id is rejected.
 *
 * Dependencies: db/connection, instance.middleware, uuid.
 */
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { requireInstanceOwnership } from '../middleware/instance.middleware';

interface SeededUser {
  id: string;
  email: string;
  instanceId: string;
}

function seedUserWithInstance(): SeededUser {
  return {
    id: uuidv4(),
    email: `instance-mw-${Date.now()}-${uuidv4().slice(0, 8)}@example.de`,
    instanceId: uuidv4(),
  };
}

/** A throwaway Express Request carrying only the fields the middleware reads. */
function mockReq(params: Record<string, string>, user?: { id: string; email: string }): Request {
  return {
    params,
    user,
    method: 'GET',
    originalUrl: '/api/v1/instances/x',
    ip: '127.0.0.1',
  } as unknown as Request;
}

/** A res double that records the status code and JSON body the middleware emits. */
function mockRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn().mockReturnThis();
  const res = { status, json } as unknown as Response;
  return { res, status, json };
}

describe('requireInstanceOwnership', () => {
  const owner = seedUserWithInstance();
  const stranger = seedUserWithInstance();

  beforeAll(async () => {
    for (const u of [owner, stranger]) {
      await db('users').insert({
        id: u.id,
        email: u.email,
        totp_enabled: false,
        created_at: new Date(),
      });
      await db('instances').insert({
        id: u.instanceId,
        user_id: u.id,
        label: `mw-${u.id.slice(0, 8)}`,
        created_at: new Date(),
      });
    }
  });

  afterAll(async () => {
    for (const u of [owner, stranger]) {
      await db('instances').where({ id: u.instanceId }).del();
      await db('users').where({ id: u.id }).del();
    }
  });

  it('passes the owner through: injects req.instance and calls next() with no error', async () => {
    const req = mockReq({ id: owner.instanceId }, { id: owner.id, email: owner.email });
    const { res, status, json } = mockRes();
    const next = jest.fn() as NextFunction;

    await requireInstanceOwnership(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(req.instance).toBeDefined();
    expect(req.instance!.id).toBe(owner.instanceId);
    expect(req.instance!.user_id).toBe(owner.id);
  });

  it('rejects a non-owner: 403 FORBIDDEN, no next(), no injected instance', async () => {
    // stranger is a real, non-admin user, but the instance belongs to owner.
    const req = mockReq({ id: owner.instanceId }, { id: stranger.id, email: stranger.email });
    const { res, status, json } = mockRes();
    const next = jest.fn() as NextFunction;

    await requireInstanceOwnership(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'Instance not found or access denied' },
    });
    expect(req.instance).toBeUndefined();
  });

  it('rejects an unknown instance id with 403 FORBIDDEN and does not call next()', async () => {
    const unknownId = uuidv4();
    const req = mockReq({ id: unknownId }, { id: owner.id, email: owner.email });
    const { res, status, json } = mockRes();
    const next = jest.fn() as NextFunction;

    await requireInstanceOwnership(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'Instance not found or access denied' },
    });
    expect(req.instance).toBeUndefined();
  });

  it('returns 400 MISSING_INSTANCE when no instance id is present in params', async () => {
    const req = mockReq({}, { id: owner.id, email: owner.email });
    const { res, status, json } = mockRes();
    const next = jest.fn() as NextFunction;

    await requireInstanceOwnership(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'MISSING_INSTANCE', message: 'Instance ID required' },
    });
  });
});
