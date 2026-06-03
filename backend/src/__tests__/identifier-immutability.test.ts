/**
 * identifier-immutability.test.ts
 * Regression: the DB-level triggers from migration 015 must reject UPDATEs
 * that try to change endpoints.identifier or organizations.identifier.
 *
 * Federated AllowList tools use the identifier as the cross-tool primary
 * key — a silent rename here would desynchronise every other consumer.
 */
import { db } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

const userEmail = `imm-test-${Date.now()}@example.de`;
const userId = uuidv4();
const instanceId = uuidv4();
const orgIdentifier = `imm-test-${Date.now()}.example.de`;
const endpointIdentifier = `dsf-fhir.${orgIdentifier}`;

describe('identifier immutability (migration 015)', () => {
  beforeAll(async () => {
    await db('users').insert({
      id: userId,
      email: userEmail,
      totp_enabled: false,
      created_at: new Date(),
    });
    await db('instances').insert({
      id: instanceId,
      user_id: userId,
      label: 'imm-test',
      created_at: new Date(),
    });
    await db('organizations').insert({
      identifier: orgIdentifier,
      instance_id: instanceId,
      name: 'Imm Test',
      active: true,
      email: `admin@${orgIdentifier}`,
      address_line: 'x',
      postal_code: '00000',
      city: 'x',
      country_code: 'DE',
      created_at: new Date(),
      updated_at: new Date(),
    });
    await db('endpoints').insert({
      identifier: endpointIdentifier,
      organization_id: orgIdentifier,
      name: 'FHIR',
      address: `https://${endpointIdentifier}/fhir`,
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  afterAll(async () => {
    await db('endpoints').where({ identifier: endpointIdentifier }).del();
    await db('organizations').where({ identifier: orgIdentifier }).del();
    await db('instances').where({ id: instanceId }).del();
    await db('users').where({ id: userId }).del();
  });

  it('rejects UPDATE that changes endpoints.identifier', async () => {
    await expect(
      db('endpoints')
        .where({ identifier: endpointIdentifier })
        .update({ identifier: 'changed.example.de' }),
    ).rejects.toThrow(/immutable/i);
  });

  it('rejects UPDATE that changes organizations.identifier', async () => {
    await expect(
      db('organizations')
        .where({ identifier: orgIdentifier })
        .update({ identifier: 'changed-org.example.de' }),
    ).rejects.toThrow(/immutable/i);
  });

  it('allows UPDATE of non-identifier columns on endpoints', async () => {
    await expect(
      db('endpoints').where({ identifier: endpointIdentifier }).update({ name: 'Renamed FHIR' }),
    ).resolves.not.toThrow();
    const row = await db('endpoints').where({ identifier: endpointIdentifier }).first();
    expect(row.name).toBe('Renamed FHIR');
  });

  it('allows UPDATE of non-identifier columns on organizations', async () => {
    await expect(
      db('organizations').where({ identifier: orgIdentifier }).update({ name: 'Renamed Org' }),
    ).resolves.not.toThrow();
    const row = await db('organizations').where({ identifier: orgIdentifier }).first();
    expect(row.name).toBe('Renamed Org');
  });
});
