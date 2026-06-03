import { describe, it, expect, beforeAll } from 'vitest';
import type { ContractClient } from './helpers/api-client';
import { adminClient } from './helpers/api-client';
import { createTestInstance } from './helpers/instance-fixture';

describe('contract: PUT /contacts/:id mutates an existing contact', () => {
  let api: ContractClient;
  let instanceId: string;
  let contactId: string;

  beforeAll(async () => {
    api = await adminClient();
    instanceId = await createTestInstance(api);
    await api.put(`/api/v1/instances/${instanceId}/organization`, {
      identifier: `cu-host-${Date.now()}.example.de`,
      name: 'Host',
      email: 'h@x.de',
      active: true,
    });
    const c = await api.post(`/api/v1/instances/${instanceId}/contacts`, {
      types: ['MEDIC'],
      email: 'orig@x.de',
    });
    contactId = c.data.data.id;
  });

  it('updates email + types', async () => {
    await api.put(`/api/v1/instances/${instanceId}/contacts/${contactId}`, {
      types: ['DSF_ADMIN', 'SECURITY'],
      email: 'updated@x.de',
    });
    const list = await api.get(`/api/v1/instances/${instanceId}/contacts`);
    const c = list.data.data.find((x: any) => x.id === contactId);
    expect(c.email).toBe('updated@x.de');
    const types = Array.isArray(c.types) ? c.types : JSON.parse(c.types || '[]');
    expect(types.sort()).toEqual(['DSF_ADMIN', 'SECURITY']);
  });
});
