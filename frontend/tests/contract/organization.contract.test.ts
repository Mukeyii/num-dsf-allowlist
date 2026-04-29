import { describe, it, expect, beforeAll } from 'vitest';
import type { AxiosInstance } from 'axios';
import { adminClient } from './helpers/api-client';
import { createTestInstance } from './helpers/instance-fixture';
import { fixtures } from './helpers/fixture-payload';

describe('contract: PUT /organization round-trips every field', () => {
  let api: AxiosInstance;
  let instanceId: string;

  beforeAll(async () => {
    api = await adminClient();
    instanceId = await createTestInstance(api);
  });

  it('persists every field the frontend Zod schema sends', async () => {
    const identifier = `${fixtures.uuid().slice(0, 8)}.example.de`;
    const payload = {
      identifier,
      name: 'Round-Trip Test Org',
      email: 'org@roundtrip.example.de',
      active: true,
      addressLine: 'Teststraße 1',
      postalCode: '12345',
      city: 'Münster',
      countryCode: 'DE',
      clientCertThumbprint: 'a'.repeat(64),
      totpCode: '123456',
    };

    const put = await api.put(`/api/v1/instances/${instanceId}/organization`, payload);
    expect(put.status).toBe(200);

    const get = await api.get(`/api/v1/instances/${instanceId}/organization`);
    expect(get.status).toBe(200);
    const org = get.data.data;
    expect(org.identifier).toBe(payload.identifier);
    expect(org.name).toBe(payload.name);
    expect(org.email).toBe(payload.email);
    expect(!!org.active).toBe(true);
    expect(org.address_line).toBe(payload.addressLine);
    expect(org.postal_code).toBe(payload.postalCode);
    expect(org.city).toBe(payload.city);
    expect(org.country_code).toBe(payload.countryCode);
    expect(org.client_cert_thumbprint).toBe(payload.clientCertThumbprint);
  });
});
