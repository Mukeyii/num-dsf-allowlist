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
};

export default config;
