/**
 * smoke.contract.test.ts – Proves the contract pipeline can hit the real
 * backend over HTTP. Real schema-drift coverage comes in Phase 2.
 */
import { describe, it, expect } from 'vitest';
import { adminClient } from './helpers/api-client';

describe('contract suite — smoke', () => {
  it('dev-login + GET /api/v1/marketplace returns shape { data: [] }', async () => {
    const api = await adminClient();
    const res = await api.get('/api/v1/marketplace');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('data');
    expect(Array.isArray(res.data.data)).toBe(true);
  });
});
