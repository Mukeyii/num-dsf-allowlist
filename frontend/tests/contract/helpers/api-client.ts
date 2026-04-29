/**
 * api-client.ts – axios + dev-login bootstrap for contract tests.
 * Hits the real Docker stack; expects DEV_AUTO_LOGIN=true.
 */
import axios, { AxiosInstance } from 'axios';

const BASE = process.env.CONTRACT_BASE_URL || 'http://localhost';

let cachedClient: AxiosInstance | null = null;

export async function adminClient(): Promise<AxiosInstance> {
  if (cachedClient) return cachedClient;
  const login = await axios.post(`${BASE}/auth/dev-login`, { role: 'admin' });
  const token = login.data.data.accessToken;
  cachedClient = axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return cachedClient;
}
