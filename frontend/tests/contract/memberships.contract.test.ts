import { describe, it, expect, beforeAll } from 'vitest';
import type { ContractClient } from './helpers/api-client';
import { adminClient } from './helpers/api-client';
import { createTestInstance } from './helpers/instance-fixture';

describe('contract: POST /memberships round-trips every field', () => {
  let api: ContractClient;
  let instanceId: string;
  let endpointId: string;

  beforeAll(async () => {
    api = await adminClient();
    instanceId = await createTestInstance(api);
    await api.put(`/api/v1/instances/${instanceId}/organization`, {
      identifier: `ms-host-${Date.now()}.example.de`,
      name: 'Host Org',
      email: 'host@x.de',
      active: true,
    });
    const epIdentifier = `ms-ep-${Date.now()}.example.de`;
    await api.post(`/api/v1/instances/${instanceId}/endpoints`, {
      identifier: epIdentifier,
      name: 'EP',
      address: 'https://x.example.de/dsf',
      ipAddresses: [{ ip: '10.0.0.1', isFhir: true, isBpe: false }],
    });
    endpointId = epIdentifier;
  });

  it('persists parentOrganization, endpointId, and roles (no phantom organizationId)', async () => {
    const payload = {
      parentOrganization: 'medizininformatik-initiative.de',
      endpointId,
      roles: ['DIC', 'HRP'],
    };

    const post = await api.post(`/api/v1/instances/${instanceId}/memberships`, payload);
    expect(post.status).toBe(201);

    const list = await api.get(`/api/v1/instances/${instanceId}/memberships`);
    const ms = list.data.data.find((x: any) => x.endpoint_id === endpointId);
    expect(ms).toBeTruthy();
    expect(ms.parent_organization).toBe(payload.parentOrganization);
    const roles = Array.isArray(ms.roles) ? ms.roles : JSON.parse(ms.roles || '[]');
    expect(roles.sort()).toEqual(['DIC', 'HRP']);
  });
});
