/**
 * fhir-bundle-latest-approval.test.ts
 * Regression test: generateFullBundle must use only the LATEST approval_request
 * per instance — not any historical one.
 *
 * Dependencies: generateFullBundle (fhir.service), db/connection (Knex)
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { generateFullBundle } from '../services/fhir.service';

interface Resource {
  resourceType: string;
  identifier?: Array<{ system: string; value: string }>;
}
interface Entry { fullUrl: string; resource: Resource }

describe('generateFullBundle — latest approval filter', () => {
  const userId = uuidv4();
  const instanceId = uuidv4();
  const orgIdentifier = 'reapproved-then-rejected.example.de';
  const userEmail = 'rar-test@example.de';

  beforeAll(async () => {
    // Cleanup stale data from previous interrupted runs
    await db('approval_requests').where({ instance_id: instanceId }).del();
    await db('organizations').where({ identifier: orgIdentifier }).del();
    await db('instances').where({ id: instanceId }).del();
    await db('users').where({ email: userEmail }).del();

    await db('users').insert({ id: userId, email: userEmail, created_at: new Date() });
    await db('instances').insert({ id: instanceId, user_id: userId, label: 'rar', created_at: new Date() });
    await db('organizations').insert({
      identifier: orgIdentifier,
      instance_id: instanceId,
      name: 'Rar Test Org',
      email: 'org@example.de',
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Older approval: APPROVED
    await db('approval_requests').insert({
      id: uuidv4(),
      instance_id: instanceId,
      status: 'APPROVED',
      submitted_at: new Date(Date.now() - 7 * 86400000),
      resolved_at: new Date(Date.now() - 6 * 86400000),
      created_at: new Date(Date.now() - 7 * 86400000),
      snapshot_json: JSON.stringify({}),
    });

    // Newer approval: REJECTED — this is the LATEST and must win
    await db('approval_requests').insert({
      id: uuidv4(),
      instance_id: instanceId,
      status: 'REJECTED',
      submitted_at: new Date(Date.now() - 1 * 86400000),
      resolved_at: new Date(Date.now() - 1 * 86400000),
      created_at: new Date(Date.now() - 1 * 86400000),
      snapshot_json: JSON.stringify({}),
    });
  });

  afterAll(async () => {
    await db('approval_requests').where({ instance_id: instanceId }).del();
    await db('organizations').where({ identifier: orgIdentifier }).del();
    await db('instances').where({ id: instanceId }).del();
    await db('users').where({ email: userEmail }).del();
  });

  it('excludes an org whose latest approval is REJECTED, even if an older one was APPROVED', async () => {
    const bundle = await generateFullBundle() as { entry: Entry[] };
    const includedIdentifiers = bundle.entry
      .filter((e) => e.resource?.resourceType === 'Organization')
      .flatMap((e) => (e.resource.identifier ?? []).map((i) => i.value));
    expect(includedIdentifiers).not.toContain(orgIdentifier);
  });
});
