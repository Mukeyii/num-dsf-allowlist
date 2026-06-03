/**
 * admin.api.test.ts – Tests for admin API client
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { adminApi } from '../../api/admin.api';
import { useAuthStore } from '../../stores/auth.store';

beforeAll(() => {
  useAuthStore.setState({
    accessToken: 'test-token',
    user: { id: '1', email: 'admin@test.de' },
    isAuthenticated: true,
  });
});

const server = setupServer(
  http.get('*/admin/approval/pending', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'req-1',
          status: 'PENDING',
          instance_id: 'inst-1',
          submitted_at: '2026-03-28T00:00:00Z',
        },
      ],
    });
  }),
  http.post('*/admin/approval/:rid/approve', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    if (!body.totpCode) {
      return HttpResponse.json(
        { error: { code: 'TOTP_REQUIRED', message: 'Authenticator code is required.' } },
        { status: 400 },
      );
    }
    return HttpResponse.json({ data: { id: 'req-1', status: 'APPROVED' } });
  }),
  http.post('*/admin/approval/:rid/reject', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    if (!body.totpCode) {
      return HttpResponse.json(
        { error: { code: 'TOTP_REQUIRED', message: 'Authenticator code is required.' } },
        { status: 400 },
      );
    }
    return HttpResponse.json({ data: { id: 'req-1', status: 'REJECTED' } });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('adminApi', () => {
  it('should fetch pending approvals', async () => {
    const res = await adminApi.getPendingApprovals();
    expect(res.data.data).toHaveLength(1);
    expect(res.data.data[0].status).toBe('PENDING');
  });

  it('should approve with TOTP code', async () => {
    const res = await adminApi.approveRequest('req-1', '123456');
    expect(res.data.data.status).toBe('APPROVED');
  });

  it('should reject with TOTP code and comment', async () => {
    const res = await adminApi.rejectRequest('req-1', 'Needs changes', '654321');
    expect(res.data.data.status).toBe('REJECTED');
  });

  it('should fail approve without TOTP code', async () => {
    try {
      await adminApi.approveRequest('req-1', '');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.response.status).toBe(400);
      expect(err.response.data.error.code).toBe('TOTP_REQUIRED');
    }
  });
});
