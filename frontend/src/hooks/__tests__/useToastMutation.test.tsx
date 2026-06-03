/**
 * useToastMutation.test.tsx — verifies the shared mutation wrapper shows a
 * success toast and runs the onSuccess callback on success, and shows the
 * extracted error message on failure. sonner is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { useToastMutation } from '../useToastMutation';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useToastMutation', () => {
  beforeEach(() => {
    toast.success.mockClear();
    toast.error.mockClear();
  });

  it('shows the success toast and runs onSuccess when the mutation resolves', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useToastMutation({ mutationFn: async () => 'ok', successMessage: 'Saved', onSuccess }),
      { wrapper },
    );
    result.current.mutate(undefined as never);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Saved'));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows the extracted error message when the mutation rejects', async () => {
    const err = { response: { data: { error: { message: 'Already exists' } } } };
    const { result } = renderHook(
      () =>
        useToastMutation({
          mutationFn: async () => {
            throw err;
          },
          successMessage: 'Saved',
        }),
      { wrapper },
    );
    result.current.mutate(undefined as never);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Already exists'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('falls back to the default error text when no envelope is present', async () => {
    const { result } = renderHook(
      () =>
        useToastMutation({
          mutationFn: async () => {
            throw new Error('boom');
          },
          successMessage: 'Saved',
        }),
      { wrapper },
    );
    result.current.mutate(undefined as never);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed'));
  });
});
