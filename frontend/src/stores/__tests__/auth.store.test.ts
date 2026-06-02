/**
 * auth.store.test.ts — pure tests for the auth store. The access token lives
 * only in memory (never persisted); setTokens authenticates, clearAuth resets.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../auth.store';

describe('useAuthStore', () => {
  beforeEach(() => useAuthStore.getState().clearAuth());

  it('starts unauthenticated', () => {
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.accessToken).toBeNull();
    expect(s.user).toBeNull();
  });

  it('authenticates on setTokens', () => {
    useAuthStore.getState().setTokens('jwt-123', { id: 'u1', email: 'a@b.de' });
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.accessToken).toBe('jwt-123');
    expect(s.user).toEqual({ id: 'u1', email: 'a@b.de' });
  });

  it('resets on clearAuth', () => {
    useAuthStore.getState().setTokens('jwt-123', { id: 'u1', email: 'a@b.de' });
    useAuthStore.getState().clearAuth();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.accessToken).toBeNull();
  });
});
