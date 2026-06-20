/**
 * useNetworkMap.test.tsx — verifies useNetworkMap() maps the cross-instance map
 * response into { organizations, isAdmin } by reading r.data.data.organizations
 * and r.data.meta.isAdmin. The network.api module is mocked so nothing hits the
 * network. A second case feeds a response whose `meta` block is absent to pin
 * down what the hook actually does on that shape (see NOTE below).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const getMap = vi.hoisted(() => vi.fn());
vi.mock('../../api/network.api', () => ({ networkApi: { getMap } }));

import { useNetworkMap } from '../useNetworkMap';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useNetworkMap', () => {
  beforeEach(() => {
    getMap.mockReset();
  });

  it('maps r.data.data.organizations and r.data.meta.isAdmin into the result', async () => {
    const organizations = [
      { identifier: 'ukm.de', name: 'Uniklinik Münster', cert_status: 'VALID' },
    ];
    getMap.mockResolvedValue({ data: { data: { organizations }, meta: { isAdmin: true } } });

    const { result } = renderHook(() => useNetworkMap(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ organizations, isAdmin: true });
    expect(getMap).toHaveBeenCalledTimes(1);
  });

  it('carries isAdmin=false through for a non-admin response', async () => {
    getMap.mockResolvedValue({
      data: { data: { organizations: [] }, meta: { isAdmin: false } },
    });

    const { result } = renderHook(() => useNetworkMap(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ organizations: [], isAdmin: false });
  });

  // NOTE: the queryFn reads r.data.meta.isAdmin with no guard. A response that
  // omits `meta` therefore throws inside the queryFn and the query lands in the
  // error state rather than degrading to a safe default. This test pins that
  // real behaviour so a future guard change is a deliberate, visible decision.
  it('errors when the response has no meta block (unguarded meta access)', async () => {
    getMap.mockResolvedValue({ data: { data: { organizations: [] } } });

    const { result } = renderHook(() => useNetworkMap(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
