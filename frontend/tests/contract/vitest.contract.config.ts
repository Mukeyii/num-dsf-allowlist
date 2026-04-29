import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/contract/**/*.contract.test.ts'],
    testTimeout: 30_000,
    environment: 'node',
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
    isolate: false,                // share module state across files (token cache)
    fileParallelism: false,        // serial — shared backend state
    server: {
      deps: { inline: ['axios'] },
    },
  },
});
