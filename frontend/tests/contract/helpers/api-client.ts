/**
 * api-client.ts – fetch-based client for contract tests.
 * Hits the real Docker stack; expects DEV_AUTO_LOGIN=true.
 *
 * Uses node's built-in fetch (no axios) because vitest's worker RPC cannot
 * structuredClone axios default config (transformRequest is a function).
 *
 * The exported `adminClient()` returns an object with the same surface
 * (`.get`, `.post`, `.put`, `.delete`) the contract tests use, returning
 * `{ status, data }` to mirror axios's response shape.
 */

const BASE = process.env.CONTRACT_BASE_URL || 'http://localhost';

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
  const login = await request<{ data: { accessToken: string } }>('POST', `${BASE}/auth/dev-login`, null, { role: 'admin' });
  const token = login.data.data.accessToken;
  return {
    get: (p) => request('GET', `${BASE}${p}`, token),
    post: (p, b) => request('POST', `${BASE}${p}`, token, b),
    put: (p, b) => request('PUT', `${BASE}${p}`, token, b),
    delete: (p, b) => request('DELETE', `${BASE}${p}`, token, b),
  };
}
