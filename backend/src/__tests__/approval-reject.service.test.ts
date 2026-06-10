/**
 * approval-reject.service.test.ts – DB-backed tests for rejectRequest's
 * serialization and duplicate-signature handling. Rejecting a PENDING request
 * finalizes it to REJECTED; a reject from an admin who already signed maps the
 * UNIQUE(approval_request_id, admin_email) violation to ALREADY_DECIDED rather
 * than letting the raw driver error escape; rejecting an already-finalized
 * request throws REQUEST_FINALIZED. notifySiteOnApproval is mocked.
 *
 * Dependencies: db/connection, approval.service, approval-reminder.service
 */
import { v4 as uuidv4 } from 'uuid';

jest.mock('../services/approval-reminder.service', () => ({
  notifyImiOnSubmit: jest.fn().mockResolvedValue(undefined),
  notifySiteOnApproval: jest.fn().mockResolvedValue(undefined),
  notifyImiOnFirstApproval: jest.fn().mockResolvedValue(undefined),
}));

import { db } from '../db/connection';
import { rejectRequest, approveRequest } from '../services/approval.service';

describe('approval.service – rejectRequest', () => {
  const instanceId = uuidv4();
  const userId = uuidv4();
  const ids: string[] = [];

  beforeAll(async () => {
    await db('users').insert({
      id: userId,
      email: `${userId}@x.de`,
      totp_enabled: false,
      created_at: new Date(),
    });
    await db('instances').insert({
      id: instanceId,
      user_id: userId,
      label: 'reject-test',
      created_at: new Date(),
    });
  });

  afterAll(async () => {
    // audit_logs has no FK to the instance, so clean it explicitly.
    await db('audit_logs').where({ instance_id: instanceId }).del();
    await db('approval_signatures').whereIn('approval_request_id', ids).del();
    await db('approval_requests').whereIn('id', ids).del();
    await db('instances').where({ id: instanceId }).del();
    await db('users').where({ id: userId }).del();
  });

  async function newPending(): Promise<string> {
    const id = uuidv4();
    ids.push(id);
    await db('approval_requests').insert({
      id,
      instance_id: instanceId,
      status: 'PENDING',
      created_at: new Date(),
      submitted_at: new Date(),
    });
    return id;
  }

  it('finalizes a PENDING request to REJECTED with a REJECT signature', async () => {
    const id = await newPending();
    await rejectRequest(id, 'a@site-one.de', 'no good', '127.0.0.1');

    const row = await db('approval_requests').where({ id }).first();
    expect(row.status).toBe('REJECTED');
    expect(row.resolved_by).toBe('a@site-one.de');

    const sig = await db('approval_signatures').where({ approval_request_id: id }).first();
    expect(sig.decision).toBe('REJECT');
  });

  it('maps a duplicate signature from the same admin to ALREADY_DECIDED', async () => {
    const id = await newPending();
    // One APPROVE from a single site leaves the request PENDING (needs a
    // second site or silent consent), so no bundle snapshot is created.
    await approveRequest(id, 'a@site-one.de', '127.0.0.1');

    // The same admin then tries to reject: the unique (request, admin_email)
    // constraint fires and must surface as ALREADY_DECIDED, not a 500.
    await expect(rejectRequest(id, 'a@site-one.de', 'changed my mind')).rejects.toThrow(
      'ALREADY_DECIDED',
    );

    const row = await db('approval_requests').where({ id }).first();
    expect(row.status).toBe('PENDING'); // unchanged by the failed reject
  });

  it('refuses to reject an already-finalized request', async () => {
    const id = await newPending();
    await rejectRequest(id, 'a@site-one.de', 'first', '127.0.0.1');
    await expect(rejectRequest(id, 'b@site-two.de', 'second')).rejects.toThrow('REQUEST_FINALIZED');
  });
});
