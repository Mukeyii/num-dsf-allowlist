/**
 * entities.api.ts – Axios client for all entity endpoints
 */
import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function authHeader() {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function api(instanceId: string) {
  const base = `${BASE}/api/v1/instances/${instanceId}`;
  return {
    getInstances: () =>
      axios.get(`${BASE}/api/v1/instances`, { headers: authHeader() }),
    createInstance: (data: { label: string }) =>
      axios.post(`${BASE}/api/v1/instances`, data, { headers: authHeader() }),

    getOrganization: () =>
      axios.get(`${base}/organization`, { headers: authHeader() }),
    updateOrganization: (data: object) =>
      axios.put(`${base}/organization`, data, { headers: authHeader() }),

    getContacts: () =>
      axios.get(`${base}/contacts`, { headers: authHeader() }),
    createContact: (data: object) =>
      axios.post(`${base}/contacts`, data, { headers: authHeader() }),
    updateContact: (id: string, data: object) =>
      axios.put(`${base}/contacts/${id}`, data, { headers: authHeader() }),
    deleteContact: (id: string) =>
      axios.delete(`${base}/contacts/${id}`, { headers: authHeader() }),

    getEndpoints: () =>
      axios.get(`${base}/endpoints`, { headers: authHeader() }),
    createEndpoint: (data: object) =>
      axios.post(`${base}/endpoints`, data, { headers: authHeader() }),
    updateEndpoint: (id: string, data: object) =>
      axios.put(`${base}/endpoints/${id}`, data, { headers: authHeader() }),
    deleteEndpoint: (id: string) =>
      axios.delete(`${base}/endpoints/${id}`, { headers: authHeader() }),

    getCertificates: () =>
      axios.get(`${base}/certificates`, { headers: authHeader() }),
    createCertificate: (pem: string) =>
      axios.post(`${base}/certificates`, { pem }, { headers: authHeader() }),
    deleteCertificate: (id: string) =>
      axios.delete(`${base}/certificates/${id}`, { headers: authHeader() }),

    getMemberships: () =>
      axios.get(`${base}/memberships`, { headers: authHeader() }),
    createMembership: (data: object) =>
      axios.post(`${base}/memberships`, data, { headers: authHeader() }),
    updateMembership: (id: string, data: object) =>
      axios.put(`${base}/memberships/${id}`, data, { headers: authHeader() }),
    deleteMembership: (id: string) =>
      axios.delete(`${base}/memberships/${id}`, { headers: authHeader() }),

    getApprovalStatus: () =>
      axios.get(`${base}/approval/status`, { headers: authHeader() }),
    getApprovalHistory: () =>
      axios.get(`${base}/approval/history`, { headers: authHeader() }),
    submitApproval: () =>
      axios.post(`${base}/approval/submit`, {}, { headers: authHeader() }),

    downloadBundle: (endpointId: string) =>
      axios.get(`${base}/download/bundle?endpointId=${endpointId}`, {
        headers: authHeader(), responseType: 'blob',
      }),
    downloadIpList: () =>
      axios.get(`${BASE}/api/v1/download/ip-address-list`, {
        headers: authHeader(), responseType: 'blob',
      }),

    getAuditLog: (params: string) =>
      axios.get(`${base}/audit?${params}`, { headers: authHeader() }),

    getExpiringCerts: () =>
      axios.get(`${base}/certificates/expiring`, { headers: authHeader() }),

    resendVerification: (contactId: string) =>
      axios.post(`${base}/contacts/${contactId}/resend-verification`, {}, { headers: authHeader() }),
  };
}

export { api };
