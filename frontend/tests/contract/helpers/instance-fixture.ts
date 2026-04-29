/**
 * instance-fixture.ts – Creates a fresh dev instance via the API for tests
 * to mutate freely without colliding with each other.
 */
import type { AxiosInstance } from 'axios';
import { faker } from '@faker-js/faker';

export async function createTestInstance(api: AxiosInstance): Promise<string> {
  const label = `contract-test-${faker.string.uuid().slice(0, 8)}`;
  const res = await api.post('/api/v1/instances', { label });
  return res.data.data.id;
}
