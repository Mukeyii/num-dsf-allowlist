/**
 * admin.api.ts – API client for IMI admin approval endpoints
 * Dependencies: axios, auth.store
 */
import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

function authHeader() {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const adminApi = {
  getPendingApprovals: () =>
    axios.get(`${BASE}/admin/approval/pending`, { headers: authHeader() }),

  approveRequest: (requestId: string, totpCode: string) =>
    axios.post(`${BASE}/admin/approval/${requestId}/approve`, { totpCode }, { headers: authHeader() }),

  rejectRequest: (requestId: string, comment: string, totpCode: string) =>
    axios.post(`${BASE}/admin/approval/${requestId}/reject`, { comment, totpCode }, { headers: authHeader() }),
};
