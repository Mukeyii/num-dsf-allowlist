/**
 * caBlacklist.api.test.ts – Tests for the admin CA-blacklist API client.
 * Verifies list/add/remove issue the right method + URL (+ body), forward the
 * bearer token, send the TOTP code in the DELETE body, and unwrap onto res.data.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { caBlacklistApi, type CaBlacklistRow, type KnownCaRow } from '../../api/caBlacklist.api';
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
  // axios DELETE-with-data still sends a body, so read it for non-GET methods.
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

const blacklistRow: CaBlacklistRow = {
  id: 'ca-1',
  subject_dn: 'CN=Bad CA',
  fingerprint: 'AA:BB',
  reason: 'compromised',
  added_by: 'admin@test.de',
  added_at: '2026-03-28T00:00:00Z',
};

const knownCa: KnownCaRow = {
  fingerprint: 'CC:DD',
  subject_dn: 'CN=Known CA',
  source: 'truststore',
  synced_at: '2026-03-28T00:00:00Z',
};

const server = setupServer(
  http.get('*/admin/ca-blacklist', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ data: { blacklist: [blacklistRow], knownCas: [knownCa] } });
  }),
  http.post('*/admin/ca-blacklist', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { id: 'ca-1' } });
  }),
  http.delete('*/admin/ca-blacklist/:id', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { deleted: true } });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  lastRequest = null;
});
afterAll(() => server.close());

describe('caBlacklistApi', () => {
  it('list() GETs /admin/ca-blacklist and unwraps blacklist + knownCas', async () => {
    const res = await caBlacklistApi.list();
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toMatch(/\/admin\/ca-blacklist$/);
    expect(lastRequest?.authorization).toBe('Bearer test-token');
    expect(res.data.data.blacklist[0].subject_dn).toBe('CN=Bad CA');
    expect(res.data.data.knownCas[0].fingerprint).toBe('CC:DD');
  });

  it('add() POSTs /admin/ca-blacklist with the full body including the totp code', async () => {
    const body = {
      subjectDn: 'CN=New CA',
      fingerprint: 'EE:FF',
      reason: 'rotation',
      totpCode: '123456',
    };
    const res = await caBlacklistApi.add(body);
    expect(lastRequest?.method).toBe('POST');
    expect(lastRequest?.pathname).toMatch(/\/admin\/ca-blacklist$/);
    expect(lastRequest?.body).toEqual(body);
    expect(res.data.data.id).toBe('ca-1');
  });

  it('add() omits optional fields when not supplied', async () => {
    const body = { subjectDn: 'CN=Minimal', totpCode: '654321' };
    await caBlacklistApi.add(body);
    expect(lastRequest?.body).toEqual(body);
  });

  it('remove() DELETEs /admin/ca-blacklist/:id with the totp code in the body', async () => {
    const res = await caBlacklistApi.remove('ca-1', '111222');
    expect(lastRequest?.method).toBe('DELETE');
    expect(lastRequest?.pathname).toMatch(/\/admin\/ca-blacklist\/ca-1$/);
    expect(lastRequest?.body).toEqual({ totpCode: '111222' });
    expect(res.data.data.deleted).toBe(true);
  });
});
