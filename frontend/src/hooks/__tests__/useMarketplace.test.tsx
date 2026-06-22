/**
 * useMarketplace.test.tsx — covers the marketplace query and mutation hooks.
 * The read hooks fetch via marketplaceApi.list()/getBySlug() and return
 * r.data.data; useMarketplaceEntry is gated by `enabled: !!slug`. The mutation
 * hooks call add/patch/remove/updateMeta (returning r.data.data) and, on success,
 * invalidate the ['marketplace'] list — useUpdateMarketplaceMeta additionally
 * invalidates the matching ['marketplace', slug] detail when a slug is passed.
 * The marketplace.api module is mocked so nothing hits the network; the per-test
 * QueryClient's invalidateQueries is spied to assert refreshed keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const list = vi.hoisted(() => vi.fn());
const getBySlug = vi.hoisted(() => vi.fn());
const add = vi.hoisted(() => vi.fn());
const patch = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
const updateMeta = vi.hoisted(() => vi.fn());
vi.mock('../../api/marketplace.api', () => ({
  marketplaceApi: { list, getBySlug, add, patch, remove, updateMeta },
}));

import {
  useMarketplace,
  useMarketplaceEntry,
  useAddMarketplace,
  useUpdateMarketplaceStatus,
  useDeleteMarketplaceEntry,
  useUpdateMarketplaceMeta,
} from '../useMarketplace';

function makeHarness() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

const invalidatedKeys = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map((c) => (c[0] as { queryKey?: unknown[] } | undefined)?.queryKey);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMarketplace', () => {
  it('fetches via marketplaceApi.list() and returns r.data.data', async () => {
    const fixture = [{ id: 'm1', slug: 'foo', name: 'Foo Process' }];
    list.mockResolvedValue({ data: { data: fixture } });
    const { wrapper } = makeHarness();

    const { result } = renderHook(() => useMarketplace(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(result.current.data).toEqual(fixture);
    expect(list).toHaveBeenCalledTimes(1);
  });
});

describe('useMarketplaceEntry', () => {
  it('fetches via getBySlug(slug) and returns r.data.data', async () => {
    const detail = { id: 'm1', slug: 'foo', name: 'Foo', releases: [] };
    getBySlug.mockResolvedValue({ data: { data: detail } });
    const { wrapper } = makeHarness();

    const { result } = renderHook(() => useMarketplaceEntry('foo'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(result.current.data).toEqual(detail);
    expect(getBySlug).toHaveBeenCalledWith('foo');
  });

  it('stays disabled (no fetch) when slug is empty', () => {
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => useMarketplaceEntry(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getBySlug).not.toHaveBeenCalled();
  });
});

describe('useAddMarketplace', () => {
  it('calls add(body), returns r.data.data, and invalidates the list', async () => {
    const created = { id: 'm2', slug: 'bar' };
    add.mockResolvedValue({ data: { data: created } });
    const { wrapper, invalidateSpy } = makeHarness();

    const { result } = renderHook(() => useAddMarketplace(), { wrapper });
    const body = { gitUrl: 'https://git/bar', status: 'APPROVED', totpCode: '123456' };
    result.current.mutate(body);

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(add).toHaveBeenCalledWith(body);
    expect(result.current.data).toEqual(created);
    expect(invalidatedKeys(invalidateSpy)).toContainEqual(['marketplace']);
  });
});

describe('useUpdateMarketplaceStatus', () => {
  it('calls patch(id, body) and invalidates the list', async () => {
    patch.mockResolvedValue({ data: { data: { id: 'm1', status: 'DEPRECATED' } } });
    const { wrapper, invalidateSpy } = makeHarness();

    const { result } = renderHook(() => useUpdateMarketplaceStatus(), { wrapper });
    const body = { status: 'DEPRECATED', totpCode: '654321' };
    result.current.mutate({ id: 'm1', body });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(patch).toHaveBeenCalledWith('m1', body);
    expect(invalidatedKeys(invalidateSpy)).toContainEqual(['marketplace']);
  });
});

describe('useDeleteMarketplaceEntry', () => {
  it('calls remove(id, body) and invalidates the list', async () => {
    remove.mockResolvedValue({ data: { data: { deleted: true } } });
    const { wrapper, invalidateSpy } = makeHarness();

    const { result } = renderHook(() => useDeleteMarketplaceEntry(), { wrapper });
    const body = { totpCode: '111111' };
    result.current.mutate({ id: 'm1', body });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(remove).toHaveBeenCalledWith('m1', body);
    expect(invalidatedKeys(invalidateSpy)).toContainEqual(['marketplace']);
  });
});

describe('useUpdateMarketplaceMeta', () => {
  it('calls updateMeta(id, body) and invalidates list + the slug detail', async () => {
    updateMeta.mockResolvedValue({ data: { data: { id: 'm1', verified: true } } });
    const { wrapper, invalidateSpy } = makeHarness();

    const { result } = renderHook(() => useUpdateMarketplaceMeta(), { wrapper });
    const body = { verified: true, totpCode: '222222' };
    result.current.mutate({ id: 'm1', slug: 'foo', body });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(updateMeta).toHaveBeenCalledWith('m1', body);

    const keys = invalidatedKeys(invalidateSpy);
    expect(keys).toContainEqual(['marketplace']);
    expect(keys).toContainEqual(['marketplace', 'foo']);
  });

  it('invalidates only the list when no slug is supplied', async () => {
    updateMeta.mockResolvedValue({ data: { data: { id: 'm1' } } });
    const { wrapper, invalidateSpy } = makeHarness();

    const { result } = renderHook(() => useUpdateMarketplaceMeta(), { wrapper });
    const body = { verified: false, totpCode: '333333' };
    result.current.mutate({ id: 'm1', body });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(updateMeta).toHaveBeenCalledWith('m1', body);

    const keys = invalidatedKeys(invalidateSpy);
    expect(keys).toContainEqual(['marketplace']);
    // no slug → no detail-key invalidation
    expect(
      keys.filter((k) => Array.isArray(k) && k.length === 2 && k[0] === 'marketplace'),
    ).toHaveLength(0);
  });
});
