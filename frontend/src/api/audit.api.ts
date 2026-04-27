/**
 * audit.api.ts – Axios client for the cross-instance audit endpoint
 * Dependencies: axios, useAuthStore
 */
import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

function authHeader() {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  user_email: string | null;
  instance_id: string | null;
  resource_type: string;
  resource_id: string | null;
  operation: string;
  diff_json: object | null;
  ip_address: string | null;
  instance_label: string | null;
  organization_identifier: string | null;
  organization_name: string | null;
}

export interface AuditResponse {
  data: AuditEntry[];
  meta: { total: number; page: number; limit: number; isAdmin: boolean };
}

export async function getCrossInstanceAudit(params: { page?: number; limit?: number }): Promise<AuditResponse> {
  const res = await axios.get<AuditResponse>(`${BASE}/audit`, {
    params,
    headers: authHeader(),
  });
  return res.data;
}
