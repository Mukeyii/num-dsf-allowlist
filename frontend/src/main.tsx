import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { router } from './router';
import { authApi } from './api/auth.api';
import { useAuthStore } from './stores/auth.store';
import { ToastProvider } from './components/ToastProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthBootstrap } from './components/AuthBootstrap';
import { getErrorMessage } from './lib/getErrorMessage';
import './index.css';
import './stores/theme.store';

// Demo mode — intercept all API calls with static mock data and pre-authenticate
if (import.meta.env.VITE_DEMO === 'true') {
  // Set auth state synchronously so RequireAuth guards don't redirect to /login
  useAuthStore.setState({
    accessToken: 'demo-token',
    user: { id: '00000000-0000-4000-8000-000000000001', email: 'demo@imi-test.example.de' },
    isAuthenticated: true,
  });
  // Register axios interceptor that serves mock responses for failed requests
  import('./api/mock-adapter').then((m) => m.setupMockAdapter());
}

// Single-flight token refresh: when several requests 401 at once, only the
// first triggers POST /auth/refresh; the rest await the same promise. The
// backend rotates the refresh cookie on every call, so concurrent refreshes
// would invalidate each other and log the user out mid-session.
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = authApi
      .refresh()
      .then((res) => {
        const accessToken = res.data.data.accessToken;
        const decoded: any = jwtDecode(accessToken);
        useAuthStore.getState().setTokens(accessToken, { id: decoded.sub, email: decoded.email });
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Axios interceptors – token refresh + global error handling
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // 401 – silent token refresh. /auth/* is excluded so the refresh call
    // itself, and login-flow 401s (bad OTP/TOTP), never re-enter the refresh
    // path. _retried bails a request that 401s again after one retry.
    if (status === 401 && !originalRequest._retried && !originalRequest.url?.includes('/auth/')) {
      originalRequest._retried = true;
      try {
        const accessToken = await refreshAccessToken();
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return axios(originalRequest);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.replace('/login');
      }
    }

    // Global error toasts (avoid duplicates with _handled flag)
    if (!error._handled) {
      const { toast } = await import('sonner');
      if (status === 429) {
        toast.error('Too many requests. Please wait a moment.');
        error._handled = true;
      } else if (status >= 500) {
        toast.error('Server error. Please try again later.');
        error._handled = true;
      } else if (!error.response) {
        toast.error('Network error. Check your connection.');
        error._handled = true;
      }
    }

    return Promise.reject(error);
  },
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if ([401, 403, 404].includes(error?.response?.status)) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error: any) => {
        const msg = getErrorMessage(error, '');
        if (msg && !msg.includes('ALREADY_')) {
          console.error('[Mutation]', msg);
        }
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap>
          <RouterProvider router={router} />
        </AuthBootstrap>
        <ToastProvider />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
