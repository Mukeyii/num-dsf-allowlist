import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/contract/**/*.contract.test.ts'],
    testTimeout: 30_000,
    environment: 'node',
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
    server: {
      deps: { inline: ['axios'] },
    },
  },
});
