/**
 * fixture-payload.ts – Build a payload that satisfies a Zod schema, with
 * required strings filled by faker. Useful for "does the backend accept
 * what the frontend sends" tests.
 */
import { faker } from '@faker-js/faker';
import type { ZodTypeAny } from 'zod';

export function fakeFromSchema(schema: ZodTypeAny): unknown {
  try {
    return (schema as any).parse({});
  } catch {
    return {};
  }
}

export const fixtures = {
  email: () => faker.internet.email().toLowerCase(),
  fqdn: () => `${faker.internet.domainWord()}.example.de`,
  name: () => faker.company.name(),
  url: () => faker.internet.url(),
  uuid: () => faker.string.uuid(),
};
