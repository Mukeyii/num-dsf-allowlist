import { describe, it, expect, beforeAll } from 'vitest';
import type { ContractClient } from './helpers/api-client';
import { adminClient } from './helpers/api-client';
import { createTestInstance } from './helpers/instance-fixture';

describe('contract: POST /contacts round-trips every field', () => {
  let api: ContractClient;
  let instanceId: string;

  beforeAll(async () => {
    api = await adminClient();
    instanceId = await createTestInstance(api);
    await api.put(`/api/v1/instances/${instanceId}/organization`, {
      identifier: `contact-host-${Date.now()}.example.de`,
      name: 'Host Org',
      email: 'host@x.de',
      active: true,
    });
  });

  it('persists every field the frontend ContactModal sends', async () => {
    const payload = {
      types: ['MEDIC', 'DSF_ADMIN'],
      name: 'Dr. Test Person',
      email: 'doctor@example.de',
      phone: '+49 251 1234567',
      addressLine: 'Klinikstraße 5',
      city: 'Münster',
      postalCode: '48149',
      countryCode: 'DE',
    };

    const post = await api.post(`/api/v1/instances/${instanceId}/contacts`, payload);
    expect(post.status).toBe(201);
    const id = post.data.data.id;

    const list = await api.get(`/api/v1/instances/${instanceId}/contacts`);
    const c = list.data.data.find((x: any) => x.id === id);
    expect(c).toBeTruthy();
    const types = Array.isArray(c.types) ? c.types : JSON.parse(c.types || '[]');
    expect(types).toEqual(payload.types);
    expect(c.name).toBe(payload.name);
    expect(c.email).toBe(payload.email);
    expect(c.phone).toBe(payload.phone);
    expect(c.address_line).toBe(payload.addressLine);
    expect(c.city).toBe(payload.city);
    expect(c.postal_code).toBe(payload.postalCode);
    expect(c.country_code).toBe(payload.countryCode);
  });
});
