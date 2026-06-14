/**
 * approval-silent-consent.service.test.ts – DB-backed test for
 * runSilentConsentSweep. Promotes a PENDING approval_request whose single
 * APPROVE signature is older than the silent-consent window to APPROVED
 * (and writes a signed bundle_versions snapshot for it), and leaves a
 * PENDING request whose only APPROVE is recent untouched. A request whose
 * old-enough APPROVE comes from a signer without a (still-valid) admin_grants
 * row also stays PENDING.
 * notifySiteOnApproval is mocked so nothing is sent.
 * Dependencies: db/connection, approval-silent-consent.service, approval-reminder.service, lib/adminGrants
 */
import { v4 as uuidv4 } from 'uuid';

jest.mock('../services/approval-reminder.service', () => ({
  notifySiteOnApproval: jest.fn().mockResolvedValue(undefined),
}));

import { db } from '../db/connection';
import { signGrant } from '../lib/adminGrants';
import { runSilentConsentSweep } from '../services/approval-silent-consent.service';

describe('approval-silent-consent.service – runSilentConsentSweep', () => {
  const instanceId = uuidv4();
  const userId = uuidv4();
  const eligibleId = uuidv4();
  const recentId = uuidv4();
  const revokedId = uuidv4();
  const eligibleAdmin = 'a@site-one.de';

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
    // The sweep only promotes on the signature of a STILL-verified admin, so
    // the eligible approver needs a signed admin_grants row (whole-second
    // granted_at: MySQL TIMESTAMP drops millis, which would break the
    // signature on read-back).
    const grantedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    await db('admin_grants')
      .insert({
        email: eligibleAdmin,
        granted_at: grantedAt,
        granted_by_a: 'SYSTEM:test',
        granted_by_b: 'SYSTEM:test',
        signature_hex: signGrant(eligibleAdmin, grantedAt, 'SYSTEM:test', 'SYSTEM:test'),
      })
      .onConflict('email')
      .ignore();
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
      {
        id: revokedId,
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
        admin_email: eligibleAdmin,
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
      {
        // Old enough for silent consent, but the signer has no admin_grants
        // row (grant revoked during the window) — must NOT be promoted.
        id: uuidv4(),
        approval_request_id: revokedId,
        admin_email: 'c@site-three.de',
        admin_site: 'site-three.de',
        decision: 'APPROVE',
        signed_at: oldSignedAt,
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
          .whereIn('approval_request_id', [eligibleId, recentId, revokedId])
          .select('id')
      ).map((b: { id: string }) => b.id);
      if (bundleIds.length) {
        await db('audit_logs').whereIn('resource_id', bundleIds).del();
        await db('bundle_versions').whereIn('id', bundleIds).del();
      }
      await db('approval_signatures')
        .whereIn('approval_request_id', [eligibleId, recentId, revokedId])
        .del();
      await db('approval_requests').whereIn('id', [eligibleId, recentId, revokedId]).del();
    } finally {
      await db('admin_grants').where({ email: eligibleAdmin }).del();
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

  it('does not promote when the only APPROVE comes from a no-longer-verified admin', async () => {
    // Run the sweep here too so this test stands alone (e.g. with -t). The
    // sweep only touches PENDING rows, so a second run is idempotent.
    await runSilentConsentSweep();

    const revoked = await db('approval_requests').where({ id: revokedId }).first();
    expect(revoked.status).toBe('PENDING');

    const noSnapshot = await db('bundle_versions')
      .where({ approval_request_id: revokedId })
      .first();
    expect(noSnapshot).toBeUndefined();
  });
});
