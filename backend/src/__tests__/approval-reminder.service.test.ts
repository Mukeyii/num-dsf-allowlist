/**
 * approval-reminder.service.test.ts – DB-backed tests for runApprovalReminders.
 * The reminder sweep selects PENDING approval_requests whose submitted_at is
 * older than three days and which have not been reminded inside the throttle
 * window, resolves each request's organization in a single batched query, and
 * sends exactly one reminder per due request (re-using sendAdminNewRequestEmail
 * with the automated-reminder marker). A request submitted recently, or one
 * that has already been resolved, is not selected and triggers no send. The
 * notification.service (the email layer) is mocked so we can assert the send
 * arguments without dispatching SMTP. A real RS256-signed admin_grants row is
 * seeded so the production listVerifiedAdminEmails() path yields a recipient.
 *
 * Dependencies: db/connection, approval-reminder.service, adminGrants (signGrant)
 */
import { v4 as uuidv4 } from 'uuid';

jest.mock('../services/notification.service', () => ({
  sendAdminNewRequestEmail: jest.fn().mockResolvedValue(undefined),
  sendAdminApprovalResultEmail: jest.fn().mockResolvedValue(undefined),
  sendAdminFirstApprovalEmail: jest.fn().mockResolvedValue(undefined),
  sendSiteApprovalResultEmail: jest.fn().mockResolvedValue(undefined),
  sendApprovedBundleNotification: jest.fn().mockResolvedValue(undefined),
}));

import { db } from '../db/connection';
import { runApprovalReminders } from '../services/approval-reminder.service';
import { sendAdminNewRequestEmail } from '../services/notification.service';
import { signGrant } from '../lib/adminGrants';
import { DAY_MS } from '../lib/time';

const sendMock = sendAdminNewRequestEmail as jest.Mock;
const REMINDER_MARKER = 'Automated reminder – request still pending';

// Suffix shared by this run's seeded data so cleanup and assertions can scope
// to our own rows even though runApprovalReminders sweeps the whole table.
const suffix = uuidv4().slice(0, 8);

const adminEmail = `reminder-admin-${suffix}@imi.example`;

// Each request needs its own instance because organizations.instance_id is
// UNIQUE (one org per instance) and the sweep keys orgs by instance_id.
const dueUserId = uuidv4();
const dueInstanceId = uuidv4();
const dueOrgId = `due-org-${suffix}.example`;
const dueRequestId = uuidv4();

const recentUserId = uuidv4();
const recentInstanceId = uuidv4();
const recentOrgId = `recent-org-${suffix}.example`;
const recentRequestId = uuidv4();

const resolvedUserId = uuidv4();
const resolvedInstanceId = uuidv4();
const resolvedOrgId = `resolved-org-${suffix}.example`;
const resolvedRequestId = uuidv4();

const fourDaysAgo = new Date(Date.now() - 4 * DAY_MS);
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

async function seedInstanceWithOrg(
  userId: string,
  instanceId: string,
  orgId: string,
): Promise<void> {
  await db('users').insert({
    id: userId,
    email: `${userId}@x.de`,
    totp_enabled: false,
    created_at: new Date(),
  });
  await db('instances').insert({
    id: instanceId,
    user_id: userId,
    label: `reminder-${suffix}`,
    created_at: new Date(),
  });
  await db('organizations').insert({
    identifier: orgId,
    instance_id: instanceId,
    name: `Org ${orgId}`,
    active: 1,
    email: `org-${orgId}@x.de`,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

beforeAll(async () => {
  // A real signed admin grant so the production listVerifiedAdminEmails() path
  // (RS256 verify over the canonical message) returns this admin as recipient.
  const grantedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
  await db('admin_grants').insert({
    email: adminEmail,
    granted_at: grantedAt,
    granted_by_a: 'SYSTEM:test',
    granted_by_b: 'SYSTEM:test',
    signature_hex: signGrant(adminEmail, grantedAt, 'SYSTEM:test', 'SYSTEM:test'),
  });

  // Due: PENDING, submitted 4 days ago, never reminded → should be selected.
  await seedInstanceWithOrg(dueUserId, dueInstanceId, dueOrgId);
  await db('contacts').insert({
    id: uuidv4(),
    organization_id: dueOrgId,
    types: JSON.stringify(['DSF_ADMIN']),
    name: 'Due Admin',
    email: `dsfadmin-${suffix}@due.example`,
    created_at: new Date(),
    updated_at: new Date(),
  });
  await db('approval_requests').insert({
    id: dueRequestId,
    instance_id: dueInstanceId,
    status: 'PENDING',
    created_at: fourDaysAgo,
    submitted_at: fourDaysAgo,
    last_reminded_at: null,
  });

  // Not-yet-due: PENDING but submitted an hour ago → outside the 3-day cutoff.
  await seedInstanceWithOrg(recentUserId, recentInstanceId, recentOrgId);
  await db('approval_requests').insert({
    id: recentRequestId,
    instance_id: recentInstanceId,
    status: 'PENDING',
    created_at: oneHourAgo,
    submitted_at: oneHourAgo,
    last_reminded_at: null,
  });

  // Already-resolved: APPROVED and old → status filter excludes it.
  await seedInstanceWithOrg(resolvedUserId, resolvedInstanceId, resolvedOrgId);
  await db('approval_requests').insert({
    id: resolvedRequestId,
    instance_id: resolvedInstanceId,
    status: 'APPROVED',
    created_at: fourDaysAgo,
    submitted_at: fourDaysAgo,
    resolved_at: new Date(),
    last_reminded_at: null,
  });
});

afterAll(async () => {
  const requestIds = [dueRequestId, recentRequestId, resolvedRequestId];
  const instanceIds = [dueInstanceId, recentInstanceId, resolvedInstanceId];
  const userIds = [dueUserId, recentUserId, resolvedUserId];
  await db('approval_requests').whereIn('id', requestIds).del();
  await db('contacts').whereIn('organization_id', [dueOrgId, recentOrgId, resolvedOrgId]).del();
  await db('organizations').whereIn('identifier', [dueOrgId, recentOrgId, resolvedOrgId]).del();
  await db('instances').whereIn('id', instanceIds).del();
  await db('users').whereIn('id', userIds).del();
  await db('admin_grants').where({ email: adminEmail }).del();
});

describe('approval-reminder.service – runApprovalReminders', () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  it('sends exactly one reminder for a due PENDING request with the resolved org and admin recipient', async () => {
    await runApprovalReminders();

    // The sweep is table-wide; scope the assertion to our seeded request id.
    const callsForDue = sendMock.mock.calls.filter((args) => args[4] === dueRequestId);
    expect(callsForDue).toHaveLength(1);

    const [adminEmails, orgName, orgIdentifier, submittedBy, requestId] = callsForDue[0];
    expect(adminEmails).toContain(adminEmail);
    expect(orgIdentifier).toBe(dueOrgId);
    expect(orgName).toBe(`Org ${dueOrgId}`);
    expect(submittedBy).toBe(REMINDER_MARKER);
    expect(requestId).toBe(dueRequestId);

    // last_reminded_at is stamped so the next sweep throttles this request.
    const row = await db('approval_requests').where({ id: dueRequestId }).first();
    expect(row.last_reminded_at).not.toBeNull();
  });

  it('does not send for a not-yet-due or an already-resolved request', async () => {
    await runApprovalReminders();

    const recentCalls = sendMock.mock.calls.filter((args) => args[4] === recentRequestId);
    const resolvedCalls = sendMock.mock.calls.filter((args) => args[4] === resolvedRequestId);
    expect(recentCalls).toHaveLength(0);
    expect(resolvedCalls).toHaveLength(0);
  });

  it('throttles a request already reminded inside the window (no duplicate send)', async () => {
    // First sweep stamped last_reminded_at; a second immediate sweep must skip it.
    await runApprovalReminders();
    const callsForDue = sendMock.mock.calls.filter((args) => args[4] === dueRequestId);
    expect(callsForDue).toHaveLength(0);
  });
});
