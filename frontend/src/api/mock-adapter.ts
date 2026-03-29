/**
 * mock-adapter.ts — Intercepts axios calls with mock data for demo mode
 * Dependencies: axios, mock-data.ts
 */
import axios from 'axios';
import { mockData } from './mock-data';

// Deep-clone so mutations don't affect the original
let data = JSON.parse(JSON.stringify(mockData));

function findOrgByInstance(instanceId: string) {
  return data.organizations.find((o: any) => o.instance_id === instanceId);
}

export function setupMockAdapter() {
  axios.interceptors.response.use(
    response => response,
    error => {
      const config = error.config;
      if (!config?.url) return Promise.reject(error);

      const url = config.url as string;
      const method = (config.method || 'get').toLowerCase();

      // Auth endpoints — always succeed in demo
      if (url.includes('/auth/')) {
        return Promise.resolve({ data: { data: { message: 'Demo mode — auth bypassed' } }, status: 200 });
      }

      // GET /api/v1/instances
      if (url.match(/\/instances$/) && method === 'get') {
        return Promise.resolve({ data: { data: data.instances }, status: 200 });
      }

      // Admin pending approvals
      if (url.includes('/admin/approval') && url.includes('pending')) {
        const pending = data.approvalHistory.filter((a: any) => a.status === 'PENDING');
        return Promise.resolve({ data: { data: pending }, status: 200 });
      }

      // Instance-scoped routes
      const instMatch = url.match(/\/instances\/([^/]+)/);
      if (instMatch) {
        const instanceId = instMatch[1];
        const org = findOrgByInstance(instanceId);

        if (url.includes('/organization') && method === 'get') {
          return Promise.resolve({ data: { data: org ?? null }, status: 200 });
        }
        if (url.includes('/contacts') && method === 'get') {
          const c = org ? data.contacts.filter((c: any) => c.organization_id === org.identifier) : [];
          return Promise.resolve({ data: { data: c }, status: 200 });
        }
        if (url.includes('/endpoints') && method === 'get') {
          const e = org ? data.endpoints.filter((e: any) => e.organization_id === org.identifier) : [];
          return Promise.resolve({ data: { data: e }, status: 200 });
        }
        if (url.includes('/certificates') && method === 'get') {
          const c = org ? data.certificates.filter((c: any) => c.organization_id === org.identifier) : [];
          return Promise.resolve({ data: { data: c }, status: 200 });
        }
        if (url.includes('/memberships') && method === 'get') {
          const m = org ? data.memberships.filter((m: any) => m.organization_id === org.identifier) : [];
          return Promise.resolve({ data: { data: m }, status: 200 });
        }
        if (url.includes('/approval/status')) {
          const a = data.approvalHistory.find((a: any) => a.instance_id === instanceId) ?? null;
          return Promise.resolve({ data: { data: a }, status: 200 });
        }
        if (url.includes('/approval/history')) {
          const h = data.approvalHistory.filter((a: any) => a.instance_id === instanceId);
          return Promise.resolve({ data: { data: h }, status: 200 });
        }
        if (url.includes('/audit')) {
          const logs = data.auditLogs.filter((l: any) => l.instance_id === instanceId);
          return Promise.resolve({ data: { data: logs, meta: { total: logs.length, pages: 1 } }, status: 200 });
        }
      }

      // Fallback — return empty list instead of rejecting
      return Promise.resolve({ data: { data: [] }, status: 200 });
    }
  );
}
