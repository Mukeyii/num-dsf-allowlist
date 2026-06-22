/**
 * admin.service.test.ts – DB-backed test for admin.service.listAllInstances.
 * Seeds two fresh users, each owning one instance + one organization, then
 * asserts the cross-tenant list contains both seeded rows with the joined
 * owner email and org name. Total count is not asserted (other suites seed too).
 * Dependencies: db/connection, admin.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import { listAllInstances, type AdminInstanceRow } from '../services/admin.service';

describe('admin.service – listAllInstances', () => {
  const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;

  const userAId = uuidv4();
  const userAEmail = `admin-svc-a-${suffix}@example.de`;
  const instanceAId = uuidv4();
  const instanceALabel = `inst-a-${suffix}`;
  const orgAId = `admin-svc-a-${suffix}.example.de`;
  const orgAName = `Org A ${suffix}`;

  const userBId = uuidv4();
  const userBEmail = `admin-svc-b-${suffix}@example.de`;
  const instanceBId = uuidv4();
  const instanceBLabel = `inst-b-${suffix}`;
  // Org B intentionally omitted so we also cover the leftJoin NULL projection.

  beforeAll(async () => {
    await db('users').insert([
      { id: userAId, email: userAEmail, totp_enabled: false, created_at: new Date() },
      { id: userBId, email: userBEmail, totp_enabled: false, created_at: new Date() },
    ]);
    await db('instances').insert([
      { id: instanceAId, user_id: userAId, label: instanceALabel, created_at: new Date() },
      { id: instanceBId, user_id: userBId, label: instanceBLabel, created_at: new Date() },
    ]);
    await db('organizations').insert({
      identifier: orgAId,
      instance_id: instanceAId,
      name: orgAName,
      active: 1,
      email: 'org-a@example.de',
      address_line: 'x',
      postal_code: '0',
      city: 'Muenster',
      country_code: 'DE',
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  afterAll(async () => {
    try {
      await db('organizations').where({ identifier: orgAId }).del();
    } finally {
      await db('instances').whereIn('id', [instanceAId, instanceBId]).del();
      await db('users').whereIn('id', [userAId, userBId]).del();
    }
  });

  it('returns both seeded instances with the owner email joined', async () => {
    const rows = await listAllInstances();
    const a = rows.find((r) => r.id === instanceAId);
    const b = rows.find((r) => r.id === instanceBId);

    expect(a).toBeTruthy();
    expect(a!.label).toBe(instanceALabel);
    expect(a!.user_email).toBe(userAEmail);

    expect(b).toBeTruthy();
    expect(b!.label).toBe(instanceBLabel);
    expect(b!.user_email).toBe(userBEmail);
  });

  it('projects the joined organization identifier and name for an instance that has one', async () => {
    const rows = await listAllInstances();
    const a = rows.find((r) => r.id === instanceAId) as AdminInstanceRow;

    expect(a.org_identifier).toBe(orgAId);
    expect(a.org_name).toBe(orgAName);
  });

  it('leaves org fields null for an instance without an organization (leftJoin)', async () => {
    const rows = await listAllInstances();
    const b = rows.find((r) => r.id === instanceBId) as AdminInstanceRow;

    expect(b.org_identifier).toBeNull();
    expect(b.org_name).toBeNull();
  });

  it('orders rows newest-first by created_at', async () => {
    const rows = await listAllInstances();
    const times = rows.map((r) => new Date(r.created_at).getTime());
    const sorted = [...times].sort((x, y) => y - x);
    expect(times).toEqual(sorted);
  });
});
