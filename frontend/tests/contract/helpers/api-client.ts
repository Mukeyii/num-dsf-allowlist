/**
 * api-client.ts – fetch-based client for contract tests.
 * Hits the real Docker stack; expects DEV_AUTO_LOGIN=true.
 *
 * Uses node's built-in fetch (no axios) because vitest's worker RPC cannot
 * structuredClone axios default config (transformRequest is a function).
 *
 * Caches the dev-login bearer token at module scope so the suite stays under
 * nginx's 5-req/min auth rate limit. Only the token string is cached — never
 * an axios/fetch response object — so vitest's worker can serialize state.
 */

const BASE = process.env.CONTRACT_BASE_URL || 'http://localhost';

// Stash on globalThis so the token survives even if vitest re-evaluates the
// module per test file. Required to stay under nginx's 5-req/min auth zone.
declare global {
  // eslint-disable-next-line no-var
  var __dsfContractAdminToken: string | undefined;
}

export interface FetchResponse<T = any> {
  status: number;
  data: T;
}

export interface ContractClient {
  get<T = any>(path: string): Promise<FetchResponse<T>>;
  post<T = any>(path: string, body?: unknown): Promise<FetchResponse<T>>;
  put<T = any>(path: string, body?: unknown): Promise<FetchResponse<T>>;
  delete<T = any>(path: string, body?: unknown): Promise<FetchResponse<T>>;
}

async function request<T = any>(
  method: string,
  url: string,
  token: string | null,
  body?: unknown,
): Promise<FetchResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (res.status >= 400) {
    const err: any = new Error(`HTTP ${res.status} ${method} ${url}: ${text.slice(0, 300)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return { status: res.status, data };
}

export async function adminClient(): Promise<ContractClient> {
  if (!globalThis.__dsfContractAdminToken) {
    const login = await request<{ data: { accessToken: string } }>(
      'POST', `${BASE}/auth/dev-login`, null, { role: 'admin' },
    );
    globalThis.__dsfContractAdminToken = login.data.data.accessToken;
  }
  const token = globalThis.__dsfContractAdminToken;
  return {
    get: (p) => request('GET', `${BASE}${p}`, token),
    post: (p, b) => request('POST', `${BASE}${p}`, token, b),
    put: (p, b) => request('PUT', `${BASE}${p}`, token, b),
    delete: (p, b) => request('DELETE', `${BASE}${p}`, token, b),
  };
}
