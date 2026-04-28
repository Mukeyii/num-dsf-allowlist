/**
 * admin.api.ts – API client for IMI admin approval + user-management endpoints
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
  post: <T = unknown>(url: string, data?: unknown) => axios.post<T>(`${BASE}${url}`, data, { headers: authHeader() }),
  delete: <T = unknown>(url: string, config?: { data?: unknown }) =>
    axios.request<T>({ method: 'DELETE', url: `${BASE}${url}`, headers: authHeader(), data: config?.data }),
};

export interface ApprovalSignature {
  id: string;
  admin_email: string;
  admin_site: string;
  decision: 'APPROVE' | 'REJECT';
  signed_at: string;
  comment?: string | null;
}

export interface PendingRequest {
  id: string;
  status: string;
  created_at?: string;
  submitted_at?: string;
  snapshot_json: string | object | null;
  signatures: ApprovalSignature[];
}

export const adminApi = {
  getPendingApprovals: () =>
    api.get<{ data: PendingRequest[] }>('/admin/approval/pending'),

  approveRequest: (requestId: string, totpCode: string) =>
    api.post<{ data: { status: 'PENDING' | 'APPROVED'; reason?: string } }>(
      `/admin/approval/${requestId}/approve`, { totpCode }
    ),

  rejectRequest: (requestId: string, comment: string, totpCode: string) =>
    api.post<{ data: { id: string; status: string } }>(`/admin/approval/${requestId}/reject`, { comment, totpCode }),
};

export interface WhitelistEntry {
  email: string;
  created_at: string;
  created_by: string | null;
  locked_at: string | null;
  locked_by: string | null;
  locked_reason: string | null;
  is_admin: boolean;
}

export const adminUsersApi = {
  list: async (): Promise<WhitelistEntry[]> => {
    const res = await api.get<{ data: WhitelistEntry[] }>('/admin/users');
    return res.data.data;
  },
  add: async (email: string, totpCode: string) => {
    const res = await api.post<{ data: { ok: true } }>('/admin/users', { email, totpCode });
    return res.data.data;
  },
  lock: async (email: string, reason: string, totpCode: string) => {
    const res = await api.post(`/admin/users/${encodeURIComponent(email)}/lock`, { reason, totpCode });
    return res.data;
  },
  unlock: async (email: string, totpCode: string) => {
    const res = await api.post(`/admin/users/${encodeURIComponent(email)}/unlock`, { totpCode });
    return res.data;
  },
  demote: async (email: string, totpCode: string) => {
    const res = await api.post(`/admin/users/${encodeURIComponent(email)}/demote`, { totpCode });
    return res.data;
  },
  remove: async (email: string, totpCode: string) => {
    const res = await api.delete(`/admin/users/${encodeURIComponent(email)}`, { data: { totpCode } });
    return res.data;
  },
};

export interface PromotionRequest {
  id: string;
  target_email: string;
  requested_by: string;
  requested_at: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  approver_b: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  resolved_at: string | null;
}

export const adminPromotionsApi = {
  list: async (): Promise<PromotionRequest[]> => {
    const res = await api.get<{ data: PromotionRequest[] }>('/admin/promotions');
    return res.data.data;
  },
  create: async (targetEmail: string, totpCode: string) => {
    const res = await api.post<{ data: { id: string } }>('/admin/promotions', { targetEmail, totpCode });
    return res.data.data;
  },
  approve: async (id: string, totpCode: string) => {
    return api.post(`/admin/promotions/${encodeURIComponent(id)}/approve`, { totpCode });
  },
  reject: async (id: string, reason: string, totpCode: string) => {
    return api.post(`/admin/promotions/${encodeURIComponent(id)}/reject`, { reason, totpCode });
  },
  cancel: async (id: string, totpCode: string) => {
    return api.post(`/admin/promotions/${encodeURIComponent(id)}/cancel`, { totpCode });
  },
};
