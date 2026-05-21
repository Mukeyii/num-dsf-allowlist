/**
 * bundleVersions.api.ts – Admin read API for the bundle version history.
 */
import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

function authHeader() {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface BundleVersionListRow {
  id: string;
  version_number: number;
  created_at: string;
  triggered_by: 'APPROVAL' | 'MANUAL' | 'RESTORE';
  triggered_by_email: string;
  content_hash: string;
  notes: string | null;
  approval_request_id: string | null;
}

export interface BundleVersionListPage {
  data: BundleVersionListRow[];
  meta: { page: number; limit: number; total: number; pages: number };
}

export interface BundleVersionDetail extends BundleVersionListRow {
  bundle_json: string;
  signature: string;
  bundle: unknown;
}

export interface BundleVersionDiff {
  added: unknown[];
  removed: unknown[];
  changed: Array<{ before: unknown; after: unknown }>;
}

export const bundleVersionsApi = {
  list: (page = 1, limit = 50) =>
    axios.get<BundleVersionListPage>(
      `${BASE}/admin/bundle-versions`,
      { params: { page, limit }, headers: authHeader() },
    ),
  get: (id: string) =>
    axios.get<{ data: BundleVersionDetail }>(
      `${BASE}/admin/bundle-versions/${id}`,
      { headers: authHeader() },
    ),
  diff: (idA: string, idB: string) =>
    axios.get<{ data: BundleVersionDiff }>(
      `${BASE}/admin/bundle-versions/${idA}/diff/${idB}`,
      { headers: authHeader() },
    ),
  downloadUrl: (id: string) => `${BASE}/admin/bundle-versions/${id}/download`,
};
