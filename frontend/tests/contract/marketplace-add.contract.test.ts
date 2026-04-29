import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { ContractClient } from './helpers/api-client';
import { adminClient } from './helpers/api-client';

describe('contract: admin POST /marketplace round-trips every field', () => {
  let api: ContractClient;
  let createdId: string | null = null;

  beforeAll(async () => { api = await adminClient(); });
  afterAll(async () => {
    if (createdId) {
      try { await api.delete(`/api/v1/admin/marketplace/${createdId}`, { totpCode: '123456' }); } catch { /* best-effort cleanup */ }
    }
  });

  it('persists gitUrl and status (TOTP bypassed in dev)', async () => {
    const payload = {
      gitUrl: `https://github.com/example/contract-test-${Date.now()}`,
      status: 'EXPERIMENTAL',
      totpCode: '123456',
    };

    const post = await api.post('/api/v1/admin/marketplace', payload);
    expect(post.status).toBe(201);
    const entry = post.data.data;
    createdId = entry.id;
    expect(entry.gitUrl).toBe(payload.gitUrl);
    expect(entry.status).toBe(payload.status);

    const list = await api.get('/api/v1/marketplace');
    const found = list.data.data.find((x: any) => x.id === entry.id);
    expect(found).toBeTruthy();
    expect(found.status).toBe(payload.status);
  });
});
