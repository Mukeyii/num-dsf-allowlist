import { describe, it, expect, beforeAll } from 'vitest';
import type { ContractClient } from './helpers/api-client';
import { adminClient } from './helpers/api-client';
import { createTestInstance } from './helpers/instance-fixture';

describe('contract: POST /endpoints round-trips ipAddresses', () => {
  let api: ContractClient;
  let instanceId: string;

  beforeAll(async () => {
    api = await adminClient();
    instanceId = await createTestInstance(api);
    await api.put(`/api/v1/instances/${instanceId}/organization`, {
      identifier: `endpoint-host-${Date.now()}.example.de`,
      name: 'Host Org',
      email: 'host@x.de',
      active: true,
    });
  });

  it('persists every field including the ipAddresses array', async () => {
    const epIdentifier = `ep-${Date.now()}.example.de`;
    const payload = {
      identifier: epIdentifier,
      name: 'Test Endpoint',
      address: 'https://fhir.example.de/dsf',
      ipAddresses: [
        { ip: '192.168.1.10', isFhir: true,  isBpe: false },
        { ip: '192.168.1.11', isFhir: false, isBpe: true  },
      ],
    };

    const post = await api.post(`/api/v1/instances/${instanceId}/endpoints`, payload);
    expect(post.status).toBe(201);

    const list = await api.get(`/api/v1/instances/${instanceId}/endpoints`);
    const ep = list.data.data.find((x: any) => x.identifier === epIdentifier);
    expect(ep).toBeTruthy();
    expect(ep.name).toBe(payload.name);
    expect(ep.address).toBe(payload.address);
    expect(Array.isArray(ep.ipAddresses)).toBe(true);
    expect(ep.ipAddresses).toHaveLength(2);
    expect(ep.ipAddresses.map((x: any) => x.ip).sort()).toEqual(['192.168.1.10', '192.168.1.11']);
  });
});
