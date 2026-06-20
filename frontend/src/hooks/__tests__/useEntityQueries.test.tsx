/**
 * useEntityQueries.test.tsx — verifies the read hooks for certificates,
 * memberships and organization each fetch via their api(instanceId) method and
 * return the array/object read from r.data.data. The entities.api module is
 * mocked (factory returning a stub client) so nothing hits the network; the
 * `enabled: !!instanceId` gate is exercised by passing null.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const getCertificates = vi.hoisted(() => vi.fn());
const getMemberships = vi.hoisted(() => vi.fn());
const getOrganization = vi.hoisted(() => vi.fn());
const apiFactory = vi.hoisted(() => vi.fn());
vi.mock('../../api/entities.api', () => ({ api: apiFactory }));

import { useCertificates } from '../useCertificates';
import { useMemberships } from '../useMemberships';
import { useOrganization } from '../useOrganization';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  getCertificates.mockReset();
  getMemberships.mockReset();
  getOrganization.mockReset();
  apiFactory.mockReset();
  apiFactory.mockReturnValue({ getCertificates, getMemberships, getOrganization });
});

describe('useCertificates', () => {
  it('fetches via api(id).getCertificates() and returns r.data.data', async () => {
    const fixture = [{ id: 'c1', subject: 'CN=ukm.de' }];
    getCertificates.mockResolvedValue({ data: { data: fixture } });

    const { result } = renderHook(() => useCertificates('inst-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(fixture);
    expect(apiFactory).toHaveBeenCalledWith('inst-1');
    expect(getCertificates).toHaveBeenCalledTimes(1);
  });

  it('stays disabled (no fetch) when instanceId is null', () => {
    const { result } = renderHook(() => useCertificates(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getCertificates).not.toHaveBeenCalled();
  });
});

describe('useMemberships', () => {
  it('fetches via api(id).getMemberships() and returns r.data.data', async () => {
    const fixture = [{ id: 'm1', parent_organization: 'num.de', roles: ['DIC'] }];
    getMemberships.mockResolvedValue({ data: { data: fixture } });

    const { result } = renderHook(() => useMemberships('inst-2'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(fixture);
    expect(apiFactory).toHaveBeenCalledWith('inst-2');
    expect(getMemberships).toHaveBeenCalledTimes(1);
  });

  it('stays disabled when instanceId is null', () => {
    const { result } = renderHook(() => useMemberships(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getMemberships).not.toHaveBeenCalled();
  });
});

describe('useOrganization', () => {
  it('fetches via api(id).getOrganization() and returns r.data.data', async () => {
    const org = { identifier: 'ukm.de', name: 'Uniklinik Münster' };
    getOrganization.mockResolvedValue({ data: { data: org } });

    const { result } = renderHook(() => useOrganization('inst-3'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(org);
    expect(apiFactory).toHaveBeenCalledWith('inst-3');
    expect(getOrganization).toHaveBeenCalledTimes(1);
  });

  it('stays disabled when instanceId is null', () => {
    const { result } = renderHook(() => useOrganization(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getOrganization).not.toHaveBeenCalled();
  });
});
