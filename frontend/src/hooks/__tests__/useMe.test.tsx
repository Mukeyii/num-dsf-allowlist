/**
 * useMe.test.tsx — verifies useMe() fetches current-user info via authApi.getMe
 * and resolves to the { email, isAdmin } object the hook reads (r.data.data).
 * The api module is mocked so nothing hits the network; the auth store is set
 * authenticated so the query is enabled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const getMe = vi.hoisted(() => vi.fn());
vi.mock('../../api/auth.api', () => ({ authApi: { getMe } }));

import { useMe } from '../useMe';
import { useAuthStore } from '../../stores/auth.store';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useMe', () => {
  beforeEach(() => {
    getMe.mockReset();
    useAuthStore.getState().clearAuth();
  });

  it('resolves to the { email, isAdmin } object read from r.data.data', async () => {
    // Hook is gated on isAuthenticated — set the store before rendering.
    useAuthStore.getState().setTokens('tok', { email: 'a@b.de', id: 'u1' });
    getMe.mockResolvedValue({ data: { data: { email: 'a@b.de', isAdmin: true } } });

    const { result } = renderHook(() => useMe(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ email: 'a@b.de', isAdmin: true });
    expect(getMe).toHaveBeenCalledTimes(1);
  });
});
