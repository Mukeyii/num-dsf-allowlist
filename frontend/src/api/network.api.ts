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

export interface MapEndpointPublic {
  identifier: string;
  name: string | null;
}

export interface MapEndpointAdmin extends MapEndpointPublic {
  address: string;
  ips: { ip: string; is_fhir: boolean; is_bpe: boolean }[];
}

export interface MapContactAdmin {
  name: string | null;
  email: string;
  phone: string | null;
  types: string[];
}

export interface MapMembershipPublic {
  parent_organization: string;
  roles: string[];
}

export interface MapMembershipAdmin extends MapMembershipPublic {
  endpoint_id: string | null;
}

export interface MapOrganization {
  identifier: string;
  name: string;
  active: boolean;
  city: string | null;
  country_code: string | null;
  cert_status: 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NONE';
  endpoints: (MapEndpointPublic | MapEndpointAdmin)[];
  memberships: (MapMembershipPublic | MapMembershipAdmin)[];
  // Admin-only fields (absent for non-admin responses)
  email?: string;
  next_cert_expiry?: string | null;
  cert_days_until?: number | null;
  contacts?: MapContactAdmin[];
  certificates_count?: number;
}

export interface MapResponse {
  organizations: MapOrganization[];
  isAdmin: boolean;
}

export const networkApi = {
  getMap: () =>
    axios.get<{ data: { organizations: MapOrganization[] }; meta: { isAdmin: boolean } }>(
      `${BASE}/network/map`, { headers: authHeader() }
    ),
};

export interface MapClusterGroup {
  city: string | null;
  country_code: string | null;
  members: MapOrganization[];
  worstStatus: MapOrganization['cert_status'];
}
