/**
 * auth.api.test.ts – Tests for the auth API client. Auth routes live at /auth/*
 * (not under /api/v1) and are sent with withCredentials so the httpOnly refresh
 * cookie rides along. Each test asserts method + path + request body, and that
 * the server response shape is returned unwrapped onto res.data. getMe()
 * additionally attaches the bearer token from the auth store.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../stores/auth.store';

beforeAll(() => {
  useAuthStore.setState({
    accessToken: 'test-token',
    user: { id: '1', email: 'admin@test.de' },
    isAuthenticated: true,
  });
});

let lastRequest: {
  method: string;
  pathname: string;
  authorization: string | null;
  body: unknown;
} | null = null;

async function capture(request: Request) {
  const url = new URL(request.url);
  let body: unknown = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const text = await request.clone().text();
    body = text ? JSON.parse(text) : null;
  }
  lastRequest = {
    method: request.method,
    pathname: url.pathname,
    authorization: request.headers.get('authorization'),
    body,
  };
}

const server = setupServer(
  http.post('*/auth/request-otp', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { message: 'sent' } });
  }),
  http.post('*/auth/verify-otp', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { tempToken: 'temp-1', requiresTotpSetup: true } });
  }),
  http.post('*/auth/setup-totp', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { qrCodeUrl: 'data:image/png;base64,zzz' } });
  }),
  http.post('*/auth/confirm-totp', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { accessToken: 'acc-1', backupCodes: ['c1', 'c2'] } });
  }),
  http.post('*/auth/verify-totp', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { accessToken: 'acc-2' } });
  }),
  http.post('*/auth/refresh', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { accessToken: 'acc-3' } });
  }),
  http.post('*/auth/logout', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { ok: true } });
  }),
  http.post('*/auth/client-cert-login', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { accessToken: 'acc-4', email: 'cert@test.de' } });
  }),
  http.post('*/auth/dev-login', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({
      data: { accessToken: 'acc-5', email: 'dev@test.de', role: 'admin' },
    });
  }),
  http.get('*/auth/me', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ data: { email: 'admin@test.de', isAdmin: true } });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  lastRequest = null;
});
afterAll(() => server.close());

describe('authApi', () => {
  it('requestOtp() POSTs /auth/request-otp with the email', async () => {
    const res = await authApi.requestOtp('user@test.de');
    expect(lastRequest?.method).toBe('POST');
    expect(lastRequest?.pathname).toBe('/auth/request-otp');
    expect(lastRequest?.body).toEqual({ email: 'user@test.de' });
    expect(res.data.data.message).toBe('sent');
  });

  it('verifyOtp() POSTs /auth/verify-otp with email + code and returns the temp token', async () => {
    const res = await authApi.verifyOtp('user@test.de', '000000');
    expect(lastRequest?.pathname).toBe('/auth/verify-otp');
    expect(lastRequest?.body).toEqual({ email: 'user@test.de', code: '000000' });
    expect(res.data.data.tempToken).toBe('temp-1');
    expect(res.data.data.requiresTotpSetup).toBe(true);
  });

  it('setupTotp() POSTs /auth/setup-totp with the temp token and returns the QR url', async () => {
    const res = await authApi.setupTotp('temp-1');
    expect(lastRequest?.pathname).toBe('/auth/setup-totp');
    expect(lastRequest?.body).toEqual({ tempToken: 'temp-1' });
    expect(res.data.data.qrCodeUrl).toContain('data:image/png');
  });

  it('confirmTotp() POSTs /auth/confirm-totp with temp token + code and returns backup codes', async () => {
    const res = await authApi.confirmTotp('temp-1', '123456');
    expect(lastRequest?.pathname).toBe('/auth/confirm-totp');
    expect(lastRequest?.body).toEqual({ tempToken: 'temp-1', code: '123456' });
    expect(res.data.data.accessToken).toBe('acc-1');
    expect(res.data.data.backupCodes).toEqual(['c1', 'c2']);
  });

  it('verifyTotp() POSTs /auth/verify-totp with temp token + code', async () => {
    const res = await authApi.verifyTotp('temp-1', '654321');
    expect(lastRequest?.pathname).toBe('/auth/verify-totp');
    expect(lastRequest?.body).toEqual({ tempToken: 'temp-1', code: '654321' });
    expect(res.data.data.accessToken).toBe('acc-2');
  });

  it('refresh() POSTs /auth/refresh with no body', async () => {
    const res = await authApi.refresh();
    expect(lastRequest?.pathname).toBe('/auth/refresh');
    expect(lastRequest?.body).toBeNull();
    expect(res.data.data.accessToken).toBe('acc-3');
  });

  it('logout() POSTs /auth/logout with the email', async () => {
    await authApi.logout('user@test.de');
    expect(lastRequest?.pathname).toBe('/auth/logout');
    expect(lastRequest?.body).toEqual({ email: 'user@test.de' });
  });

  it('clientCertLogin() POSTs /auth/client-cert-login with no body', async () => {
    const res = await authApi.clientCertLogin();
    expect(lastRequest?.pathname).toBe('/auth/client-cert-login');
    expect(lastRequest?.body).toBeNull();
    expect(res.data.data.email).toBe('cert@test.de');
  });

  it('devLogin() POSTs /auth/dev-login with the role when given', async () => {
    const res = await authApi.devLogin('admin');
    expect(lastRequest?.pathname).toBe('/auth/dev-login');
    expect(lastRequest?.body).toEqual({ role: 'admin' });
    expect(res.data.data.role).toBe('admin');
  });

  it('devLogin() POSTs an empty body when no role is given', async () => {
    await authApi.devLogin();
    expect(lastRequest?.body).toEqual({});
  });

  it('getMe() GETs /auth/me with the bearer token from the store', async () => {
    const res = await authApi.getMe();
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toBe('/auth/me');
    expect(lastRequest?.authorization).toBe('Bearer test-token');
    expect(res.data.data.isAdmin).toBe(true);
  });
});
