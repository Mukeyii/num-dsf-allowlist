/**
 * marketplace.api.ts – API calls for /marketplace + /admin/marketplace
 * Dependencies: axios, auth.store
 */
import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

function authHeader() {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const api = {
  get: <T>(url: string) => axios.get<T>(`${BASE}${url}`, { headers: authHeader() }),
  post: <T = unknown>(url: string, data?: unknown) =>
    axios.post<T>(`${BASE}${url}`, data, { headers: authHeader() }),
  patch: <T = unknown>(url: string, data?: unknown) =>
    axios.patch<T>(`${BASE}${url}`, data, { headers: authHeader() }),
  delete: <T = unknown>(url: string, config?: { data?: unknown }) =>
    axios.request<T>({ method: 'DELETE', url: `${BASE}${url}`, headers: authHeader(), data: config?.data }),
};

export interface MarketplaceEntry {
  id: string;
  gitUrl: string;
  name: string;
  description: string | null;
  status: 'APPROVED' | 'EXPERIMENTAL' | 'DEPRECATED';
  latestReleaseTag: string | null;
  lastCommitAt: string | null;
  stars: number;
  license: string | null;
  syncAt: string | null;
  syncError: string | null;
}

export const marketplaceApi = {
  list: () =>
    api.get<{ data: MarketplaceEntry[] }>('/marketplace'),
  add: (body: { gitUrl: string; status: string; totpCode: string }) =>
    api.post<{ data: MarketplaceEntry }>('/admin/marketplace', body),
  patch: (id: string, body: { status: string; totpCode: string }) =>
    api.patch<{ data: MarketplaceEntry }>(`/admin/marketplace/${id}`, body),
  remove: (id: string, body: { totpCode: string }) =>
    api.delete<{ data: { deleted: true } }>(`/admin/marketplace/${id}`, { data: body }),
};
