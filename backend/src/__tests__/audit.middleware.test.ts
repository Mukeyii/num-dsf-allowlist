/**
 * audit.middleware.test.ts – Unit tests for the audit-writing middleware path.
 *
 * NOTE ON TARGET: the project layout in CLAUDE.md lists a planned
 * `middleware/audit.middleware.ts`, but no such file exists. Audit writes are
 * implemented in `services/audit.service.ts` (`writeAuditLog`) and the ONLY
 * middleware that drives an audit write off a mutating request is
 * `requireInstanceOwnership` in `middleware/instance.middleware.ts`: when an
 * IMI admin touches another user's instance it records the cross-tenant access
 * as an `audit_logs` row. That branch is the live realisation of the audit
 * middleware contract, so this suite exercises it as a unit on a minimal
 * express app + supertest.
 *
 * Contract under test:
 *   1. An admin cross-tenant request writes exactly one AUTH/LOGIN audit_logs
 *      row carrying the request method/path and target owner id, and still
 *      injects req.instance + calls next (response succeeds).
 *   2. The audit write is fire-and-forget: a rejected writeAuditLog must NOT
 *      block or fail the response (the try/catch / `.catch(() => {})` contract).
 *   3. An owner accessing their OWN instance is not audited (no admin trail).
 *
 * Real Redis is untouched — req.user is injected directly so the middleware is
 * driven as a unit, without going through requireAuth's redis activity write.
 * All seeded rows (admin user + grant, owner user, instance, audit rows) use
 * unique uuid/email fixtures and are torn down in afterAll.
 *
 * Dependencies: express, supertest, db/connection, audit.service, seed helper.
 */
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { signGrant } from '../lib/adminGrants';
import * as auditService from '../services/audit.service';
import { requireInstanceOwnership } from '../middleware/instance.middleware';

const sfx = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const adminEmail = `audit-mw-admin-${sfx}@example.de`;
const adminId = uuidv4();
const ownerEmail = `audit-mw-owner-${sfx}@example.de`;
const ownerId = uuidv4();
const instanceId = uuidv4();

/**
 * Minimal app: inject a chosen identity as req.user, run the middleware under
 * test, then a terminal handler that echoes the injected req.instance so we can
 * prove next() ran and the instance was attached.
 */
function buildApp(user: { id: string; email: string }) {
  const app = express();
  app.get(
    '/probe/:id',
    (req: Request, _res: Response, next: NextFunction) => {
      req.user = user;
      next();
    },
    requireInstanceOwnership,
    (req: Request, res: Response) => {
      res.status(200).json({ instanceId: req.instance?.id ?? null });
    },
  );
  return app;
}

/**
 * The audit write is fire-and-forget, so the row may land a tick after the HTTP
 * response returns. Poll briefly for the cross-tenant AUTH row.
 */
async function waitForAdminAuditRow(): Promise<Record<string, unknown> | undefined> {
  for (let i = 0; i < 40; i++) {
    const row = await db('audit_logs')
      .where({ instance_id: instanceId, user_email: adminEmail, resource_type: 'AUTH' })
      .first();
    if (row) return row;
    await new Promise((r) => setTimeout(r, 25));
  }
  return undefined;
}

describe('audit middleware – requireInstanceOwnership cross-tenant audit write', () => {
  beforeAll(async () => {
    // Owner of the instance.
    await db('email_whitelist').insert({
      id: uuidv4(),
      email: ownerEmail,
      created_by: 'test',
      created_at: new Date(),
    });
    await db('users').insert({
      id: ownerId,
      email: ownerEmail,
      totp_enabled: false,
      created_at: new Date(),
    });
    await db('instances').insert({
      id: instanceId,
      user_id: ownerId,
      label: 'audit-mw-instance',
      created_at: new Date(),
    });

    // A verified IMI admin (signed grant so isAdminEmail resolves true).
    await db('email_whitelist').insert({
      id: uuidv4(),
      email: adminEmail,
      created_by: 'test',
      created_at: new Date(),
    });
    await db('users').insert({
      id: adminId,
      email: adminEmail,
      totp_enabled: false,
      created_at: new Date(),
    });
    const grantedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    await db('admin_grants').insert({
      email: adminEmail,
      granted_at: grantedAt,
      granted_by_a: 'SYSTEM:test',
      granted_by_b: 'SYSTEM:test',
      signature_hex: signGrant(adminEmail, grantedAt, 'SYSTEM:test', 'SYSTEM:test'),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await db('audit_logs').where({ instance_id: instanceId }).del();
    await db('instances').where({ id: instanceId }).del();
    await db('admin_grants').where({ email: adminEmail }).del();
    await db('users').whereIn('id', [adminId, ownerId]).del();
    await db('email_whitelist').whereIn('email', [adminEmail, ownerEmail]).del();
  });

  it('admin cross-tenant access injects req.instance, calls next, and writes one AUTH/LOGIN audit row', async () => {
    const res = await request(buildApp({ id: adminId, email: adminEmail })).get(
      `/probe/${instanceId}`,
    );

    // next() ran and the instance was attached.
    expect(res.status).toBe(200);
    expect(res.body.instanceId).toBe(instanceId);

    const row = await waitForAdminAuditRow();
    expect(row).toBeDefined();
    expect(row!.user_email).toBe(adminEmail);
    expect(row!.instance_id).toBe(instanceId);
    expect(row!.resource_type).toBe('AUTH');
    expect(row!.operation).toBe('LOGIN');

    // diff_json carries the cross-tenant context (method/path/target owner).
    const raw = row!.diff_json as unknown;
    const diff = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>;
    expect(diff.action).toBe('admin_instance_access');
    expect(diff.method).toBe('GET');
    expect(diff.path).toBe(`/probe/${instanceId}`);
    expect(diff.targetOwnerId).toBe(ownerId);

    // Exactly one audit row was written for this access.
    const count = await db('audit_logs')
      .where({ instance_id: instanceId, user_email: adminEmail })
      .count<{ c: number }[]>({ c: '*' });
    expect(Number(count[0].c)).toBe(1);
  });

  it('a failed audit write does NOT block the response (fire-and-forget try/catch contract)', async () => {
    // Start from a clean slate so the no-persistence assertion is unambiguous.
    await db('audit_logs').where({ instance_id: instanceId }).del();

    const spy = jest
      .spyOn(auditService, 'writeAuditLog')
      .mockRejectedValueOnce(new Error('audit sink down'));

    const res = await request(buildApp({ id: adminId, email: adminEmail })).get(
      `/probe/${instanceId}`,
    );

    // Despite the rejected audit write the request still succeeds end to end.
    expect(res.status).toBe(200);
    expect(res.body.instanceId).toBe(instanceId);
    // The middleware did attempt the write (it just must not surface the error).
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({
      userEmail: adminEmail,
      instanceId,
      resourceType: 'AUTH',
      operation: 'LOGIN',
    });

    // Let the rejected (and any stray) fire-and-forget write settle, then assert
    // nothing was persisted: the write was intercepted and its failure swallowed.
    await new Promise((r) => setTimeout(r, 150));
    const rows = await db('audit_logs').where({ instance_id: instanceId });
    expect(rows).toHaveLength(0);
  });

  it('owner accessing their own instance is not audited (no admin trail)', async () => {
    // Clear any rows from earlier tests so the absence assertion is meaningful.
    await db('audit_logs').where({ instance_id: instanceId }).del();

    const res = await request(buildApp({ id: ownerId, email: ownerEmail })).get(
      `/probe/${instanceId}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.instanceId).toBe(instanceId);

    // Give any (erroneous) fire-and-forget write a chance to land, then assert none did.
    await new Promise((r) => setTimeout(r, 150));
    const rows = await db('audit_logs').where({ instance_id: instanceId });
    expect(rows).toHaveLength(0);
  });
});
