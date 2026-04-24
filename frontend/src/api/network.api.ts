/**
 * network.api.ts – Cross-instance network map (allow list view)
 * Dependencies: axios, auth.store
 */
import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

function authHeader() {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface MapEndpoint {
  identifier: string;
  name: string | null;
  address: string;
  ips: { ip: string; is_fhir: boolean; is_bpe: boolean }[];
}

export interface MapContact {
  name: string | null;
  email: string;
  phone: string | null;
  types: string[];
}

export interface MapMembership {
  parent_organization: string;
  endpoint_id: string | null;
  roles: string[];
}

export interface MapOrganization {
  identifier: string;
  name: string;
  active: boolean;
  email: string;
  city: string | null;
  country_code: string | null;
  cert_status: 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NONE';
  next_cert_expiry: string | null;
  endpoints: MapEndpoint[];
  contacts: MapContact[];
  memberships: MapMembership[];
  certificates_count: number;
}

export const networkApi = {
  getMap: () =>
    axios.get<{ data: { organizations: MapOrganization[] } }>(
      `${BASE}/network/map`, { headers: authHeader() }
    ),
};
