/**
 * useInstance.test.tsx — verifies useInstances() fetches the instance list via
 * api('_').getInstances() and returns the array read from r.data.data. The
 * entities.api module is mocked (factory returning a stub client) so nothing
 * hits the network; the auth store is set so the query is enabled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const getInstances = vi.hoisted(() => vi.fn());
vi.mock('../../api/entities.api', () => ({
  api: () => ({ getInstances }),
}));

import { useInstances } from '../useInstance';
import { useAuthStore } from '../../stores/auth.store';
import { useCanvasStore } from '../../stores/canvas.store';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useInstances', () => {
  beforeEach(() => {
    getInstances.mockReset();
    useAuthStore.getState().clearAuth();
    useCanvasStore.setState({ activeInstanceId: null });
  });

  it('returns the instance list read from r.data.data', async () => {
    // Gated on an authenticated user — set the store before rendering.
    useAuthStore.getState().setTokens('tok', { email: 'a@b.de', id: 'u1' });
    const fixture = [{ id: 'inst-1', label: 'ukm.de' }];
    getInstances.mockResolvedValue({ data: { data: fixture } });

    const { result } = renderHook(() => useInstances(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(fixture);
    expect(getInstances).toHaveBeenCalledTimes(1);
  });
});
