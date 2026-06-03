/**
 * auth.store.ts – Zustand store for auth state
 * accessToken kept in memory (never localStorage/sessionStorage – XSS protection)
 * Refresh token lives as httpOnly cookie – not accessible from JS
 */
import { create } from 'zustand';

interface AuthUser {
  email: string;
  id: string;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  setTokens: (accessToken: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setTokens: (accessToken, user) => set({ accessToken, user, isAuthenticated: true }),

  clearAuth: () => set({ accessToken: null, user: null, isAuthenticated: false }),
}));
