/**
 * entities.api.test.ts – Tests for the entity API client. The api(instanceId)
 * factory builds instance-scoped CRUD helpers for organization, contacts,
 * endpoints, certificates and memberships, plus approval/download/audit helpers.
 * Each test asserts the HTTP method + URL (incl. the /instances/:id prefix,
 * query params and encodeURIComponent on the bundle download), the request body
 * where applicable, and the unwrapped response. The top-level
 * downloadFullAllowListBundle helper is covered too.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { api, downloadFullAllowListBundle } from '../../api/entities.api';
import { useAuthStore } from '../../stores/auth.store';

beforeAll(() => {
  useAuthStore.setState({
    accessToken: 'test-token',
    user: { id: '1', email: 'admin@test.de' },
    isAuthenticated: true,
  });
});

let lastRequest: {
  method: string;
  pathname: string;
  search: URLSearchParams;
  authorization: string | null;
  body: unknown;
} | null = null;

async function capture(request: Request) {
  const url = new URL(request.url);
  let body: unknown = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const text = await request.clone().text();
    body = text ? JSON.parse(text) : null;
  }
  lastRequest = {
    method: request.method,
    pathname: url.pathname,
    search: url.searchParams,
    authorization: request.headers.get('authorization'),
    body,
  };
}

// axios responses from this module are untyped (no generic), so res.data is
// `unknown` to us. This narrow shape lets tests read the unwrapped payload
// without `any`.
type Envelope = { data?: { id?: string; identifier?: string; ok?: boolean } };

const server = setupServer(
  // Instances (BASE-level, not under /instances/:id)
  http.get('*/api/v1/instances', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ data: [{ id: 'inst-1' }] });
  }),
  http.post('*/api/v1/instances', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { id: 'inst-new' } });
  }),
  http.get('*/instances/:id', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ data: { id: 'inst-1' } });
  }),
  // Organization
  http.get('*/instances/:id/organization', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ data: { identifier: 'ukm.de' } });
  }),
  http.put('*/instances/:id/organization', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { identifier: 'ukm.de' } });
  }),
  // Contacts
  http.get('*/instances/:id/contacts', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ data: [{ id: 'c-1' }] });
  }),
  http.post('*/instances/:id/contacts', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { id: 'c-1' } });
  }),
  http.put('*/instances/:id/contacts/:cid', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { id: 'c-1' } });
  }),
  http.delete('*/instances/:id/contacts/:cid', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ data: { ok: true } });
  }),
  http.post('*/instances/:id/contacts/:cid/resend-verification', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { ok: true } });
  }),
  // Endpoints
  http.post('*/instances/:id/endpoints', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { id: 'e-1' } });
  }),
  http.put('*/instances/:id/endpoints/:eid', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { id: 'e-1' } });
  }),
  // Certificates
  http.post('*/instances/:id/certificates/:cid/renew', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { id: 'cert-2' } });
  }),
  http.get('*/instances/:id/certificates/expiring', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ data: [] });
  }),
  http.post('*/instances/:id/certificates', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { id: 'cert-1' } });
  }),
  http.delete('*/instances/:id/certificates/:cid', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ data: { ok: true } });
  }),
  // Memberships
  http.post('*/instances/:id/memberships', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { id: 'm-1' } });
  }),
  http.delete('*/instances/:id/memberships/:mid', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ data: { ok: true } });
  }),
  // Approval
  http.post('*/instances/:id/approval/submit', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { ok: true } });
  }),
  // Downloads / audit
  http.get('*/instances/:id/download/bundle', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ ok: true });
  }),
  http.get('*/api/v1/download/ip-address-list', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ ok: true });
  }),
  http.get('*/instances/:id/audit', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ data: [] });
  }),
  http.get('*/api/v1/download/full-bundle', ({ request }) => {
    void capture(request);
    return HttpResponse.json({ ok: true });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  lastRequest = null;
});
afterAll(() => server.close());

const INSTANCE = 'inst-1';
const client = () => api(INSTANCE);

describe('entities api – instance-scoped factory', () => {
  it('getInstances() GETs /instances with the token', async () => {
    const res = await client().getInstances();
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toMatch(/\/api\/v1\/instances$/);
    expect(lastRequest?.authorization).toBe('Bearer test-token');
    expect((res.data as Envelope).data).toEqual([{ id: 'inst-1' }]);
  });

  it('createInstance() POSTs /instances with the label body', async () => {
    await client().createInstance({ label: 'ukm.de' });
    expect(lastRequest?.method).toBe('POST');
    expect(lastRequest?.pathname).toMatch(/\/api\/v1\/instances$/);
    expect(lastRequest?.body).toEqual({ label: 'ukm.de' });
  });

  it('getInstance() GETs /instances/:id', async () => {
    await client().getInstance('inst-9');
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-9$/);
  });
});

describe('entities api – organization', () => {
  it('getOrganization() GETs /instances/:id/organization', async () => {
    const res = await client().getOrganization();
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/organization$/);
    expect((res.data as Envelope).data?.identifier).toBe('ukm.de');
  });

  it('updateOrganization() PUTs /instances/:id/organization with the body', async () => {
    await client().updateOrganization({ name: 'UKM', active: true });
    expect(lastRequest?.method).toBe('PUT');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/organization$/);
    expect(lastRequest?.body).toEqual({ name: 'UKM', active: true });
  });
});

describe('entities api – contacts', () => {
  it('getContacts() GETs /instances/:id/contacts', async () => {
    await client().getContacts();
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/contacts$/);
  });

  it('createContact() POSTs the contact body', async () => {
    await client().createContact({ email: 'c@ukm.de', types: ['MEDIC'] });
    expect(lastRequest?.method).toBe('POST');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/contacts$/);
    expect(lastRequest?.body).toEqual({ email: 'c@ukm.de', types: ['MEDIC'] });
  });

  it('updateContact() PUTs /contacts/:id with the body', async () => {
    await client().updateContact('c-1', { name: 'New Name' });
    expect(lastRequest?.method).toBe('PUT');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/contacts\/c-1$/);
    expect(lastRequest?.body).toEqual({ name: 'New Name' });
  });

  it('deleteContact() DELETEs /contacts/:id', async () => {
    await client().deleteContact('c-1');
    expect(lastRequest?.method).toBe('DELETE');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/contacts\/c-1$/);
  });

  it('resendVerification() POSTs /contacts/:id/resend-verification with an empty body', async () => {
    await client().resendVerification('c-1');
    expect(lastRequest?.method).toBe('POST');
    expect(lastRequest?.pathname).toMatch(
      /\/instances\/inst-1\/contacts\/c-1\/resend-verification$/,
    );
    expect(lastRequest?.body).toEqual({});
  });
});

describe('entities api – endpoints', () => {
  it('createEndpoint() POSTs the endpoint body', async () => {
    await client().createEndpoint({ address: 'https://fhir.ukm.de' });
    expect(lastRequest?.method).toBe('POST');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/endpoints$/);
    expect(lastRequest?.body).toEqual({ address: 'https://fhir.ukm.de' });
  });

  it('updateEndpoint() PUTs /endpoints/:id with the body', async () => {
    await client().updateEndpoint('e-1', { name: 'FHIR' });
    expect(lastRequest?.method).toBe('PUT');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/endpoints\/e-1$/);
    expect(lastRequest?.body).toEqual({ name: 'FHIR' });
  });
});

describe('entities api – certificates', () => {
  it('createCertificate() POSTs the pem in a { pem } body', async () => {
    await client().createCertificate('PEM-CONTENT');
    expect(lastRequest?.method).toBe('POST');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/certificates$/);
    expect(lastRequest?.body).toEqual({ pem: 'PEM-CONTENT' });
  });

  it('deleteCertificate() DELETEs /certificates/:id', async () => {
    await client().deleteCertificate('cert-1');
    expect(lastRequest?.method).toBe('DELETE');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/certificates\/cert-1$/);
  });

  it('renewCertificate() POSTs /certificates/:id/renew with the pem body', async () => {
    await client().renewCertificate('cert-1', 'PEM-RENEW');
    expect(lastRequest?.method).toBe('POST');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/certificates\/cert-1\/renew$/);
    expect(lastRequest?.body).toEqual({ pem: 'PEM-RENEW' });
  });

  it('getExpiringCerts() GETs /certificates/expiring', async () => {
    await client().getExpiringCerts();
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/certificates\/expiring$/);
  });
});

describe('entities api – memberships', () => {
  it('createMembership() POSTs the membership body', async () => {
    await client().createMembership({ parent_organization: 'num.de', roles: ['DIC'] });
    expect(lastRequest?.method).toBe('POST');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/memberships$/);
    expect(lastRequest?.body).toEqual({ parent_organization: 'num.de', roles: ['DIC'] });
  });

  it('deleteMembership() DELETEs /memberships/:id', async () => {
    await client().deleteMembership('m-1');
    expect(lastRequest?.method).toBe('DELETE');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/memberships\/m-1$/);
  });
});

describe('entities api – approval, downloads, audit', () => {
  it('submitApproval() POSTs /approval/submit with an empty body', async () => {
    await client().submitApproval();
    expect(lastRequest?.method).toBe('POST');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/approval\/submit$/);
    expect(lastRequest?.body).toEqual({});
  });

  it('downloadBundle() encodes the endpointId into the query string', async () => {
    await client().downloadBundle('https://fhir.ukm.de/Endpoint');
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/download\/bundle$/);
    // axios re-decodes the query; assert the value round-trips correctly.
    expect(lastRequest?.search.get('endpointId')).toBe('https://fhir.ukm.de/Endpoint');
  });

  it('downloadIpList() GETs the BASE-level ip-address-list', async () => {
    await client().downloadIpList();
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toMatch(/\/api\/v1\/download\/ip-address-list$/);
  });

  it('getAuditLog() forwards the raw query string', async () => {
    await client().getAuditLog('page=2&limit=20&resource=ORGANIZATION&operation=UPDATE');
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toMatch(/\/instances\/inst-1\/audit$/);
    expect(lastRequest?.search.get('page')).toBe('2');
    expect(lastRequest?.search.get('limit')).toBe('20');
    expect(lastRequest?.search.get('resource')).toBe('ORGANIZATION');
    expect(lastRequest?.search.get('operation')).toBe('UPDATE');
  });
});

describe('downloadFullAllowListBundle', () => {
  it('GETs the BASE-level full-bundle with the token', async () => {
    await downloadFullAllowListBundle();
    expect(lastRequest?.method).toBe('GET');
    expect(lastRequest?.pathname).toMatch(/\/api\/v1\/download\/full-bundle$/);
    expect(lastRequest?.authorization).toBe('Bearer test-token');
  });
});
