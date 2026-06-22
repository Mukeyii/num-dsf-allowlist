/**
 * marketplace.api.test.ts – Tests for the marketplace API client. Verifies each
 * exported function issues the right method + URL (+ body) and returns the
 * server's response shape unwrapped onto res.data.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { marketplaceApi, type MarketplaceMetaBody } from '../../api/marketplace.api';
import { useAuthStore } from '../../stores/auth.store';

beforeAll(() => {
  useAuthStore.setState({
    accessToken: 'test-token',
    user: { id: '1', email: 'admin@test.de' },
    isAuthenticated: true,
  });
});

// Captures the last intercepted request so each test can assert method/URL/body.
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

const entry = {
  id: 'mp-1',
  slug: 'dsf-process',
  gitUrl: 'https://github.com/owner/dsf-process',
  name: 'DSF Process',
  status: 'APPROVED',
};

const server = setupServer(
  http.get('*/marketplace', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ data: [entry] });
  }),
  http.get('*/marketplace/:slug', ({ request }) => {
    void capture(request);
    return HttpResponse.json({
      data: { ...entry, releases: [{ tag: 'v1.0.0', publishedAt: null }] },
    });
  }),
  http.post('*/admin/marketplace', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: entry });
  }),
  http.patch('*/admin/marketplace/:id/meta', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { ...entry, status: 'DEPRECATED' } });
  }),
  http.patch('*/admin/marketplace/:id', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { ...entry, status: 'EXPERIMENTAL' } });
  }),
  http.delete('*/admin/marketplace/:id', async ({ request }) => {
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

describe('marketplaceApi', () => {
  it('list() issues GET /marketplace and unwraps the entry array', async () => {
    const res = await marketplaceApi.list();
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toMatch(/\/marketplace$/);
    expect(lastRequest?.authorization).toBe('Bearer test-token');
    expect(res.data.data).toHaveLength(1);
    expect(res.data.data[0].slug).toBe('dsf-process');
  });

  it('getBySlug() encodes the slug and returns the detail with releases', async () => {
    const res = await marketplaceApi.getBySlug('dsf process/v2');
    expect(lastRequest?.method).toBe('GET');
    // encodeURIComponent turns the space + slash into %20 / %2F.
    expect(lastRequest?.pathname).toMatch(/\/marketplace\/dsf%20process%2Fv2$/);
    expect(res.data.data.releases[0].tag).toBe('v1.0.0');
  });

  it('add() POSTs to /admin/marketplace with the gitUrl/status/totp body', async () => {
    const body = {
      gitUrl: 'https://github.com/owner/repo',
      status: 'APPROVED',
      totpCode: '123456',
    };
    const res = await marketplaceApi.add(body);
    expect(lastRequest?.method).toBe('POST');
    expect(lastRequest?.pathname).toMatch(/\/admin\/marketplace$/);
    expect(lastRequest?.body).toEqual(body);
    expect(res.data.data.id).toBe('mp-1');
  });

  it('patch() PATCHes /admin/marketplace/:id with status + totp', async () => {
    const res = await marketplaceApi.patch('mp-1', { status: 'EXPERIMENTAL', totpCode: '654321' });
    expect(lastRequest?.method).toBe('PATCH');
    expect(lastRequest?.pathname).toMatch(/\/admin\/marketplace\/mp-1$/);
    expect(lastRequest?.body).toEqual({ status: 'EXPERIMENTAL', totpCode: '654321' });
    expect(res.data.data.status).toBe('EXPERIMENTAL');
  });

  it('updateMeta() PATCHes /admin/marketplace/:id/meta with the full meta body', async () => {
    const meta: MarketplaceMetaBody = {
      status: 'DEPRECATED',
      verified: true,
      advisoryText: 'superseded',
      advisorySeverity: 'WARNING',
      supersededBy: 'new-slug',
      processIdentifiers: ['a', 'b'],
      requiredRoles: ['DIC'],
      messageNames: ['start'],
      totpCode: '111111',
    };
    const res = await marketplaceApi.updateMeta('mp-1', meta);
    expect(lastRequest?.method).toBe('PATCH');
    expect(lastRequest?.pathname).toMatch(/\/admin\/marketplace\/mp-1\/meta$/);
    expect(lastRequest?.body).toEqual(meta);
    expect(res.data.data.status).toBe('DEPRECATED');
  });

  it('remove() issues DELETE /admin/marketplace/:id with totp in the body', async () => {
    const res = await marketplaceApi.remove('mp-1', { totpCode: '222222' });
    expect(lastRequest?.method).toBe('DELETE');
    expect(lastRequest?.pathname).toMatch(/\/admin\/marketplace\/mp-1$/);
    expect(lastRequest?.body).toEqual({ totpCode: '222222' });
    expect(res.data.data.deleted).toBe(true);
  });
});
