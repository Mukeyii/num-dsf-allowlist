import { describe, it, expect, beforeAll } from 'vitest';
import type { ContractClient } from './helpers/api-client';
import { adminClient } from './helpers/api-client';
import { createTestInstance } from './helpers/instance-fixture';

describe('contract: PUT /organization mutates an existing record', () => {
  let api: ContractClient;
  let instanceId: string;

  beforeAll(async () => {
    api = await adminClient();
    instanceId = await createTestInstance(api);
  });

  it('a second PUT updates the city field', async () => {
    const id = `update-${Date.now()}.example.de`;
    await api.put(`/api/v1/instances/${instanceId}/organization`, {
      identifier: id, name: 'Update Org', email: 'u@x.de', active: true, city: 'Münster',
    });
    await api.put(`/api/v1/instances/${instanceId}/organization`, {
      identifier: id, name: 'Update Org', email: 'u@x.de', active: true, city: 'Heilbronn',
    });
    const get = await api.get(`/api/v1/instances/${instanceId}/organization`);
    expect(get.data.data.city).toBe('Heilbronn');
  });
});
