/**
 * endpoints.service.test.ts – DB-backed CRUD test for endpoints.service.
 * Exercises getEndpoints/createEndpoint/updateEndpoint/deleteEndpoint plus
 * endpoint_ips aggregation. All functions key on instanceId.
 * Dependencies: db/connection, endpoints.service
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/connection';
import {
  getEndpoints,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
} from '../services/endpoints.service';

describe('endpoints.service', () => {
  const org = `svc-endpoints-${Date.now()}-${uuidv4().slice(0, 8)}.example.de`;
  const instanceId = uuidv4();
  const userId = uuidv4();
  const endpointId = `ep-${Date.now()}-${uuidv4().slice(0, 8)}.example.de`;
  const email = 'caller@example.de';

  beforeAll(async () => {
    await db('users').insert({ id: userId, email: `${userId}@x.de`, totp_enabled: false, created_at: new Date() });
    await db('instances').insert({ id: instanceId, user_id: userId, label: 'svc', created_at: new Date() });
    await db('organizations').insert({
      identifier: org, instance_id: instanceId, name: 'Svc', active: 1,
      email: 'x@x.de', address_line: 'x', postal_code: '0', city: 'x',
      country_code: 'DE', created_at: new Date(), updated_at: new Date(),
    });
  });

  afterAll(async () => {
    try {
      const eps = await db('endpoints').where({ organization_id: org }).select('identifier');
      await db('endpoint_ips').whereIn('endpoint_id', eps.map((e: any) => e.identifier)).del();
      await db('endpoints').where({ organization_id: org }).del();
    } finally {
      await db('organizations').where({ identifier: org }).del();
      await db('instances').where({ id: instanceId }).del();
      await db('users').where({ id: userId }).del();
    }
  });

  it('creates, lists, updates and deletes an endpoint with IPs', async () => {
    const created = await createEndpoint(
      instanceId,
      { identifier: endpointId, name: 'EP', address: 'https://ep.example.de/fhir', ipAddresses: [{ ip: '10.0.0.1', isFhir: true }] },
      email, '127.0.0.1',
    );
    expect(created!.identifier).toBe(endpointId);
    expect(created!.ipAddresses).toHaveLength(1);

    const listed = await getEndpoints(instanceId);
    expect(listed.some((e: any) => e.identifier === endpointId)).toBe(true);

    const updated = await updateEndpoint(instanceId, endpointId, { name: 'EP2' }, email, '127.0.0.1');
    expect(updated!.name).toBe('EP2');

    await deleteEndpoint(instanceId, endpointId, email, '127.0.0.1');
    const after = await getEndpoints(instanceId);
    expect(after.some((e: any) => e.identifier === endpointId)).toBe(false);
  });
});
