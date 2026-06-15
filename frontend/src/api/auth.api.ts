/**
 * auth.api.ts – Axios client for all auth endpoints
 * Auth routes live at /auth/* (not under /api/v1/).
 *
 * Uses the default axios singleton — the same instance the rest of the app and
 * the main.tsx interceptors (refresh + error toasts) and the demo mock-adapter
 * hook — so a 401 on /auth/me and global error handling run consistently. The
 * 401-refresh interceptor excludes /auth/*, so these calls never recurse.
 */
import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

// withCredentials is required so the browser sends the httpOnly refresh cookie
// on /auth/refresh and /auth/logout. Set per-request (not on axios.defaults) so
// the Bearer-only entity APIs on the same singleton are unaffected.
const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
const authConfig = {
  baseURL: baseOrigin,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
};

function authHeader() {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface OtpRequestResponse {
  data: { message: string };
}

export interface OtpVerifyResponse {
  data: { tempToken: string; requiresTotpSetup: boolean };
}

export interface TotpSetupResponse {
  data: { qrCodeUrl: string };
}

export interface TotpConfirmResponse {
  data: { accessToken: string; backupCodes: string[] };
}

export interface TotpVerifyResponse {
  data: { accessToken: string };
}

export const authApi = {
  requestOtp: (email: string) =>
    axios.post<OtpRequestResponse>('/auth/request-otp', { email }, authConfig),

  verifyOtp: (email: string, code: string) =>
    axios.post<OtpVerifyResponse>('/auth/verify-otp', { email, code }, authConfig),

  setupTotp: (tempToken: string) =>
    axios.post<TotpSetupResponse>('/auth/setup-totp', { tempToken }, authConfig),

  confirmTotp: (tempToken: string, code: string) =>
    axios.post<TotpConfirmResponse>('/auth/confirm-totp', { tempToken, code }, authConfig),

  verifyTotp: (tempToken: string, code: string) =>
    axios.post<TotpVerifyResponse>('/auth/verify-totp', { tempToken, code }, authConfig),

  refresh: () =>
    axios.post<{ data: { accessToken: string } }>('/auth/refresh', undefined, authConfig),

  logout: (email: string) =>
    axios.post('/auth/logout', { email }, authConfig),

  clientCertLogin: () =>
    axios.post<{ data: { accessToken: string; email: string } }>(
      '/auth/client-cert-login',
      undefined,
      authConfig,
    ),

  devLogin: (role?: 'admin' | 'member' | 'site') =>
    axios.post<{ data: { accessToken: string; email: string; role: 'admin' | 'member' | 'site' } }>(
      '/auth/dev-login',
      role ? { role } : {},
      authConfig,
    ),

  getMe: () =>
    axios.get<{ data: { email: string; isAdmin: boolean } }>('/auth/me', {
      ...authConfig,
      headers: { ...authConfig.headers, ...authHeader() },
    }),
};
