import { describe, it, expect, beforeAll } from 'vitest';
import type { ContractClient } from './helpers/api-client';
import { adminClient } from './helpers/api-client';
import { createTestInstance } from './helpers/instance-fixture';

describe('contract: PUT /endpoints/:id mutates ipAddresses', () => {
  let api: ContractClient;
  let instanceId: string;
  let endpointId: string;

  beforeAll(async () => {
    api = await adminClient();
    instanceId = await createTestInstance(api);
    await api.put(`/api/v1/instances/${instanceId}/organization`, {
      identifier: `eu-host-${Date.now()}.example.de`,
      name: 'Host',
      email: 'h@x.de',
      active: true,
    });
    const epId = `eu-${Date.now()}.example.de`;
    await api.post(`/api/v1/instances/${instanceId}/endpoints`, {
      identifier: epId,
      address: 'https://x.example.de/dsf',
      ipAddresses: [{ ip: '10.0.0.1', isFhir: true, isBpe: false }],
    });
    endpointId = epId;
  });

  it('replaces the ipAddresses array entirely', async () => {
    await api.put(`/api/v1/instances/${instanceId}/endpoints/${endpointId}`, {
      address: 'https://x.example.de/dsf',
      ipAddresses: [
        { ip: '10.0.0.5', isFhir: true, isBpe: false },
        { ip: '10.0.0.6', isFhir: false, isBpe: true },
      ],
    });
    const list = await api.get(`/api/v1/instances/${instanceId}/endpoints`);
    const ep = list.data.data.find((x: any) => x.identifier === endpointId);
    expect(ep.ipAddresses.map((x: any) => x.ip).sort()).toEqual(['10.0.0.5', '10.0.0.6']);
  });
});
