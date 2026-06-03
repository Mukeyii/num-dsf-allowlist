import { describe, it, expect, beforeAll } from 'vitest';
import type { ContractClient } from './helpers/api-client';
import { adminClient } from './helpers/api-client';

describe('contract: admin POST /promotions creates a pending request', () => {
  let api: ContractClient;
  beforeAll(async () => {
    api = await adminClient();
  });

  it('creates a PENDING promotion for the target email (TOTP bypassed)', async () => {
    // Add a fresh whitelist email first so promote has a target.
    const targetEmail = `promo-target-${Date.now()}@example.de`;
    await api.post('/api/v1/admin/users', { email: targetEmail, totpCode: '123456' });

    const post = await api.post('/api/v1/admin/promotions', {
      targetEmail,
      totpCode: '123456',
    });
    expect([201, 200]).toContain(post.status);
    const reqId = post.data.data.id;
    expect(typeof reqId).toBe('string');

    const list = await api.get('/api/v1/admin/promotions');
    const found = list.data.data.find((r: any) => r.id === reqId);
    expect(found).toBeTruthy();
    expect(found.target_email).toBe(targetEmail);
    expect(found.status).toBe('PENDING');
  });
});
