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
    axios.get<{ data: PendingRequest[] }>(`${BASE}/admin/approval/pending`, { headers: authHeader() }),

  approveRequest: (requestId: string, totpCode: string) =>
    axios.post<{ data: { status: 'PENDING' | 'APPROVED'; reason?: string } }>(
      `${BASE}/admin/approval/${requestId}/approve`, { totpCode }, { headers: authHeader() }
    ),

  rejectRequest: (requestId: string, comment: string, totpCode: string) =>
    axios.post(`${BASE}/admin/approval/${requestId}/reject`, { comment, totpCode }, { headers: authHeader() }),
};
