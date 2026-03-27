/**
 * auth.api.ts – Axios client for all auth endpoints
 * Base URL from Vite env variable VITE_API_URL
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

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
    api.post<OtpRequestResponse>('/auth/request-otp', { email }),

  verifyOtp: (email: string, code: string) =>
    api.post<OtpVerifyResponse>('/auth/verify-otp', { email, code }),

  setupTotp: (tempToken: string) =>
    api.post<TotpSetupResponse>('/auth/setup-totp', { tempToken }),

  confirmTotp: (tempToken: string, code: string) =>
    api.post<TotpConfirmResponse>('/auth/confirm-totp', { tempToken, code }),

  verifyTotp: (tempToken: string, code: string) =>
    api.post<TotpVerifyResponse>('/auth/verify-totp', { tempToken, code }),

  refresh: () =>
    api.post<{ data: { accessToken: string } }>('/auth/refresh'),

  logout: (email: string) =>
    api.post('/auth/logout', { email }),
};
