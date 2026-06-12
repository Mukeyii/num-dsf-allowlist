/**
 * approval-silent-consent.service.test.ts – DB-backed test for
 * runSilentConsentSweep. Promotes a PENDING approval_request whose single
 * APPROVE signature is older than the silent-consent window to APPROVED
 * (and writes a signed bundle_versions snapshot for it), and leaves a
 * PENDING request whose only APPROVE is recent untouched.
 * notifySiteOnApproval is mocked so nothing is sent.
 * Dependencies: db/connection, approval-silent-consent.service, approval-reminder.service
 */
import { v4 as uuidv4 } from 'uuid';

jest.mock('../services/approval-reminder.service', () => ({
  notifySiteOnApproval: jest.fn().mockResolvedValue(undefined),
}));

import { db } from '../db/connection';
import { runSilentConsentSweep } from '../services/approval-silent-consent.service';

describe('approval-silent-consent.service – runSilentConsentSweep', () => {
  const instanceId = uuidv4();
  const userId = uuidv4();
  const eligibleId = uuidv4();
  const recentId = uuidv4();

  const day = 86400_000;
  const oldSignedAt = new Date(Date.now() - 30 * day); // well past 7-day window
  const recentSignedAt = new Date(Date.now() - 1 * day);

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
      label: 'silent',
      created_at: new Date(),
    });
    await db('approval_requests').insert([
      {
        id: eligibleId,
        instance_id: instanceId,
        status: 'PENDING',
        created_at: new Date(),
        submitted_at: new Date(),
      },
      {
        id: recentId,
        instance_id: instanceId,
        status: 'PENDING',
        created_at: new Date(),
        submitted_at: new Date(),
      },
    ]);
    await db('approval_signatures').insert([
      {
        id: uuidv4(),
        approval_request_id: eligibleId,
        admin_email: 'a@site-one.de',
        admin_site: 'site-one.de',
        decision: 'APPROVE',
        signed_at: oldSignedAt,
      },
      {
        id: uuidv4(),
        approval_request_id: recentId,
        admin_email: 'b@site-two.de',
        admin_site: 'site-two.de',
        decision: 'APPROVE',
        signed_at: recentSignedAt,
      },
    ]);
  });

  afterAll(async () => {
    try {
      // The sweep promotes a request and writes an (unmocked) audit_logs row
      // scoped to this instance; audit_logs has no FK, so clean it explicitly.
      await db('audit_logs').where({ instance_id: instanceId }).del();
      // The promotion also snapshots the bundle (bundle_versions row with an
      // ON DELETE SET NULL FK to approval_requests, plus an audit_logs row
      // keyed by the snapshot id) — remove both before the requests.
      const bundleIds = (
        await db('bundle_versions')
          .whereIn('approval_request_id', [eligibleId, recentId])
          .select('id')
      ).map((b: { id: string }) => b.id);
      if (bundleIds.length) {
        await db('audit_logs').whereIn('resource_id', bundleIds).del();
        await db('bundle_versions').whereIn('id', bundleIds).del();
      }
      await db('approval_signatures').whereIn('approval_request_id', [eligibleId, recentId]).del();
      await db('approval_requests').whereIn('id', [eligibleId, recentId]).del();
    } finally {
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });

  it('promotes the request whose only APPROVE is past the window, not the recent one', async () => {
    const promoted = await runSilentConsentSweep();
    expect(promoted).toBeGreaterThanOrEqual(1);

    const eligible = await db('approval_requests').where({ id: eligibleId }).first();
    expect(eligible.status).toBe('APPROVED');
    expect(eligible.resolved_by).toBe('SYSTEM:silent-consent');

    const recent = await db('approval_requests').where({ id: recentId }).first();
    expect(recent.status).toBe('PENDING');

    // The promotion must leave a signed bundle snapshot behind.
    const snapshot = await db('bundle_versions').where({ approval_request_id: eligibleId }).first();
    expect(snapshot).toBeDefined();
    expect(snapshot.triggered_by).toBe('APPROVAL');
    expect(snapshot.triggered_by_email).toBe('SYSTEM:silent-consent');

    const noSnapshot = await db('bundle_versions').where({ approval_request_id: recentId }).first();
    expect(noSnapshot).toBeUndefined();
  });
});
