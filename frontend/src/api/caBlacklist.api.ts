/**
 * caBlacklist.api.ts – Admin CRUD for the CA blacklist + known-CAs picker.
 */
import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

function authHeader() {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface CaBlacklistRow {
  id: string;
  subject_dn: string;
  fingerprint: string | null;
  reason: string | null;
  added_by: string;
  added_at: string;
}

export interface KnownCaRow {
  fingerprint: string;
  subject_dn: string;
  source: string;
  synced_at: string;
}

export const caBlacklistApi = {
  list: () =>
    axios.get<{ data: { blacklist: CaBlacklistRow[]; knownCas: KnownCaRow[] } }>(
      `${BASE}/admin/ca-blacklist`,
      { headers: authHeader() },
    ),
  add: (body: { subjectDn: string; fingerprint?: string; reason?: string; totpCode: string }) =>
    axios.post<{ data: { id: string } }>(
      `${BASE}/admin/ca-blacklist`,
      body,
      { headers: authHeader() },
    ),
  remove: (id: string, totpCode: string) =>
    axios.delete<{ data: { deleted: true } }>(
      `${BASE}/admin/ca-blacklist/${id}`,
      { headers: authHeader(), data: { totpCode } },
    ),
};
