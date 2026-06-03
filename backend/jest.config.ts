/**
 * jest.config.ts – Jest configuration for backend tests
 * Uses ts-jest for TypeScript support, targets __tests__ directories under src/
 */
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: './src',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['./__tests__/setup.ts'],
  testTimeout: 15000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  collectCoverageFrom: ['**/*.ts', '!**/__tests__/**', '!**/*.d.ts', '!index.ts'],
  coverageThreshold: {
    global: {
      statements: 59,
      branches: 38,
      functions: 55,
      lines: 61,
    },
  },
};

export default config;
