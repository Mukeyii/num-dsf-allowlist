import { describe, it, expect, beforeAll } from 'vitest';
import type { ContractClient } from './helpers/api-client';
import { adminClient } from './helpers/api-client';

describe('contract: admin POST /users adds whitelist entry', () => {
  let api: ContractClient;
  beforeAll(async () => { api = await adminClient(); });

  it('persists email + locked state default (TOTP bypassed)', async () => {
    const email = `contract-${Date.now()}@example.de`;
    const payload = { email, totpCode: '123456' };

    const post = await api.post('/api/v1/admin/users', payload);
    expect([201, 200]).toContain(post.status);

    const list = await api.get('/api/v1/admin/users');
    const found = list.data.data.find((x: any) => x.email === email);
    expect(found).toBeTruthy();
    expect(found.locked_at == null).toBe(true);
  });
});
