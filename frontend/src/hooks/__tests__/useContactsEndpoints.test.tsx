/**
 * useContactsEndpoints.test.tsx — covers the contact and endpoint hooks. The
 * read hooks (useContacts/useEndpoints) fetch via api(id).getX() and return
 * r.data.data, gated by `enabled: !!instanceId`. The mutation hooks call the
 * matching api method and, on success, invalidate their own list key, the shared
 * post-mutation caches (invalidateAfterEntityMutation), and — for endpoint
 * update/delete — the memberships key. The entities.api module is mocked (factory
 * returning a stub client) so nothing hits the network; invalidateQueries is
 * spied on the per-test QueryClient to assert the refreshed keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const getContacts = vi.hoisted(() => vi.fn());
const createContact = vi.hoisted(() => vi.fn());
const updateContact = vi.hoisted(() => vi.fn());
const deleteContact = vi.hoisted(() => vi.fn());
const getEndpoints = vi.hoisted(() => vi.fn());
const createEndpoint = vi.hoisted(() => vi.fn());
const updateEndpoint = vi.hoisted(() => vi.fn());
const deleteEndpoint = vi.hoisted(() => vi.fn());
const apiFactory = vi.hoisted(() => vi.fn());
vi.mock('../../api/entities.api', () => ({ api: apiFactory }));

import { useContacts, useCreateContact, useUpdateContact, useDeleteContact } from '../useContacts';
import {
  useEndpoints,
  useCreateEndpoint,
  useUpdateEndpoint,
  useDeleteEndpoint,
} from '../useEndpoints';

// Build a fresh QueryClient + wrapper per test, returning the spy so each
// mutation test can assert exactly which cache keys were invalidated on success.
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
  apiFactory.mockReturnValue({
    getContacts,
    createContact,
    updateContact,
    deleteContact,
    getEndpoints,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
  });
});

describe('useContacts (read)', () => {
  it('fetches via api(id).getContacts() and returns r.data.data', async () => {
    const fixture = [{ id: 'ct1', email: 'medic@ukm.de', types: ['MEDIC'] }];
    getContacts.mockResolvedValue({ data: { data: fixture } });
    const { wrapper } = makeHarness();

    const { result } = renderHook(() => useContacts('inst-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(result.current.data).toEqual(fixture);
    expect(apiFactory).toHaveBeenCalledWith('inst-1');
    expect(getContacts).toHaveBeenCalledTimes(1);
  });

  it('stays disabled (no fetch) when instanceId is null', () => {
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => useContacts(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getContacts).not.toHaveBeenCalled();
  });
});

describe('useCreateContact', () => {
  it('calls createContact and invalidates the contacts list + shared caches', async () => {
    createContact.mockResolvedValue({ data: { data: { id: 'ct-new' } } });
    const { wrapper, invalidateSpy } = makeHarness();

    const { result } = renderHook(() => useCreateContact('inst-1'), { wrapper });
    const payload = { email: 'new@ukm.de', types: ['MEDIC'] };
    result.current.mutate(payload);

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(apiFactory).toHaveBeenCalledWith('inst-1');
    expect(createContact).toHaveBeenCalledWith(payload);

    const keys = invalidatedKeys(invalidateSpy);
    expect(keys).toContainEqual(['contacts', 'inst-1']);
    expect(keys).toContainEqual(['approval-status', 'inst-1']);
    expect(keys).toContainEqual(['network', 'map']);
    expect(keys).toContainEqual(['audit']);
  });
});

describe('useUpdateContact', () => {
  it('calls updateContact(id, data) and invalidates list + shared caches', async () => {
    updateContact.mockResolvedValue({ data: { data: { id: 'ct1' } } });
    const { wrapper, invalidateSpy } = makeHarness();

    const { result } = renderHook(() => useUpdateContact('inst-1'), { wrapper });
    const data = { email: 'updated@ukm.de' };
    result.current.mutate({ id: 'ct1', data });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(updateContact).toHaveBeenCalledWith('ct1', data);
    expect(invalidatedKeys(invalidateSpy)).toContainEqual(['contacts', 'inst-1']);
  });
});

describe('useDeleteContact', () => {
  it('calls deleteContact(id) and invalidates list + shared caches', async () => {
    deleteContact.mockResolvedValue({ data: { data: { deleted: true } } });
    const { wrapper, invalidateSpy } = makeHarness();

    const { result } = renderHook(() => useDeleteContact('inst-1'), { wrapper });
    result.current.mutate('ct1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(deleteContact).toHaveBeenCalledWith('ct1');
    expect(invalidatedKeys(invalidateSpy)).toContainEqual(['contacts', 'inst-1']);
  });
});

describe('useEndpoints (read)', () => {
  it('fetches via api(id).getEndpoints() and returns r.data.data', async () => {
    const fixture = [{ identifier: 'fhir.ukm.de', address: 'https://fhir.ukm.de' }];
    getEndpoints.mockResolvedValue({ data: { data: fixture } });
    const { wrapper } = makeHarness();

    const { result } = renderHook(() => useEndpoints('inst-2'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(result.current.data).toEqual(fixture);
    expect(apiFactory).toHaveBeenCalledWith('inst-2');
    expect(getEndpoints).toHaveBeenCalledTimes(1);
  });

  it('stays disabled when instanceId is null', () => {
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => useEndpoints(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getEndpoints).not.toHaveBeenCalled();
  });
});

describe('useCreateEndpoint', () => {
  it('calls createEndpoint and invalidates endpoints + shared caches', async () => {
    createEndpoint.mockResolvedValue({ data: { data: { identifier: 'fhir.ukm.de' } } });
    const { wrapper, invalidateSpy } = makeHarness();

    const { result } = renderHook(() => useCreateEndpoint('inst-2'), { wrapper });
    const payload = { identifier: 'fhir.ukm.de', address: 'https://fhir.ukm.de' };
    result.current.mutate(payload);

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(createEndpoint).toHaveBeenCalledWith(payload);

    const keys = invalidatedKeys(invalidateSpy);
    expect(keys).toContainEqual(['endpoints', 'inst-2']);
    expect(keys).toContainEqual(['network', 'map']);
    // create does NOT touch memberships (only update/delete do)
    expect(keys).not.toContainEqual(['memberships', 'inst-2']);
  });
});

describe('useUpdateEndpoint', () => {
  it('calls updateEndpoint(id, data) and also invalidates memberships', async () => {
    updateEndpoint.mockResolvedValue({ data: { data: { identifier: 'fhir.ukm.de' } } });
    const { wrapper, invalidateSpy } = makeHarness();

    const { result } = renderHook(() => useUpdateEndpoint('inst-2'), { wrapper });
    const data = { name: 'Renamed FHIR' };
    result.current.mutate({ id: 'fhir.ukm.de', data });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(updateEndpoint).toHaveBeenCalledWith('fhir.ukm.de', data);

    const keys = invalidatedKeys(invalidateSpy);
    expect(keys).toContainEqual(['endpoints', 'inst-2']);
    expect(keys).toContainEqual(['memberships', 'inst-2']);
  });
});

describe('useDeleteEndpoint', () => {
  it('calls deleteEndpoint(id) and also invalidates memberships', async () => {
    deleteEndpoint.mockResolvedValue({ data: { data: { deleted: true } } });
    const { wrapper, invalidateSpy } = makeHarness();

    const { result } = renderHook(() => useDeleteEndpoint('inst-2'), { wrapper });
    result.current.mutate('fhir.ukm.de');

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 4000 });
    expect(deleteEndpoint).toHaveBeenCalledWith('fhir.ukm.de');

    const keys = invalidatedKeys(invalidateSpy);
    expect(keys).toContainEqual(['endpoints', 'inst-2']);
    expect(keys).toContainEqual(['memberships', 'inst-2']);
  });
});
