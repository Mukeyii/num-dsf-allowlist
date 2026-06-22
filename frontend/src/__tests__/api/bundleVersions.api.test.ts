/**
 * bundleVersions.api.test.ts – Tests for the admin bundle-version history API
 * client. Verifies list/get/diff issue the right GET method + URL (with the
 * page/limit query on list and the id path params on get/diff), send the bearer
 * token, and unwrap onto res.data. downloadUrl is a pure URL builder.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  bundleVersionsApi,
  type BundleVersionListPage,
  type BundleVersionDetail,
  type BundleVersionDiff,
} from '../../api/bundleVersions.api';
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
  search: URLSearchParams;
  authorization: string | null;
} | null = null;

function capture(request: Request) {
  const url = new URL(request.url);
  lastRequest = {
    method: request.method,
    pathname: url.pathname,
    search: url.searchParams,
    authorization: request.headers.get('authorization'),
  };
}

const row: BundleVersionListPage['data'][number] = {
  id: 'bv-1',
  version_number: 7,
  created_at: '2026-03-28T00:00:00Z',
  triggered_by: 'APPROVAL',
  triggered_by_email: 'admin@test.de',
  content_hash: 'deadbeef',
  notes: null,
  approval_request_id: 'req-1',
};

const detail: BundleVersionDetail = {
  ...row,
  bundle_json: '{}',
  signature: 'sig',
  bundle: { resourceType: 'Bundle' },
};

const diff: BundleVersionDiff = {
  added: [{ id: 'x' }],
  removed: [],
  changed: [{ before: { a: 1 }, after: { a: 2 } }],
};

const server = setupServer(
  http.get('*/admin/bundle-versions', ({ request }) => {
    capture(request);
    const page: BundleVersionListPage = {
      data: [row],
      meta: { page: 1, limit: 50, total: 1, pages: 1 },
    };
    return HttpResponse.json(page);
  }),
  http.get('*/admin/bundle-versions/:idA/diff/:idB', ({ request }) => {
    capture(request);
    return HttpResponse.json({ data: diff });
  }),
  http.get('*/admin/bundle-versions/:id', ({ request }) => {
    capture(request);
    return HttpResponse.json({ data: detail });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  lastRequest = null;
});
afterAll(() => server.close());

describe('bundleVersionsApi', () => {
  it('list() GETs /admin/bundle-versions with default page/limit and the token', async () => {
    const res = await bundleVersionsApi.list();
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toMatch(/\/admin\/bundle-versions$/);
    expect(lastRequest?.authorization).toBe('Bearer test-token');
    expect(lastRequest?.search.get('page')).toBe('1');
    expect(lastRequest?.search.get('limit')).toBe('50');
    expect(res.data.data).toHaveLength(1);
    expect(res.data.data[0].version_number).toBe(7);
    expect(res.data.meta.total).toBe(1);
  });

  it('list() forwards explicit page/limit as query params', async () => {
    await bundleVersionsApi.list(3, 10);
    expect(lastRequest?.search.get('page')).toBe('3');
    expect(lastRequest?.search.get('limit')).toBe('10');
  });

  it('get() GETs /admin/bundle-versions/:id and unwraps the detail', async () => {
    const res = await bundleVersionsApi.get('bv-1');
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toMatch(/\/admin\/bundle-versions\/bv-1$/);
    expect(res.data.data.signature).toBe('sig');
    expect(res.data.data.bundle).toEqual({ resourceType: 'Bundle' });
  });

  it('diff() GETs /admin/bundle-versions/:idA/diff/:idB and unwraps the diff', async () => {
    const res = await bundleVersionsApi.diff('bv-1', 'bv-2');
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toMatch(/\/admin\/bundle-versions\/bv-1\/diff\/bv-2$/);
    expect(res.data.data.added).toHaveLength(1);
    expect(res.data.data.changed[0].after).toEqual({ a: 2 });
  });

  it('downloadUrl() builds the download URL without issuing a request', () => {
    const url = bundleVersionsApi.downloadUrl('bv-9');
    expect(url).toMatch(/\/admin\/bundle-versions\/bv-9\/download$/);
    expect(lastRequest).toBeNull();
  });
});
