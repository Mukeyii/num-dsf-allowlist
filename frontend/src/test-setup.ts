/**
 * test-setup.ts – Vitest setup file.
 * Loaded once before each test file via vitest.config.ts `setupFiles`.
 * Adds jest-dom matchers + jest-axe matchers to expect.
 */
import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

expect.extend({ toHaveNoViolations });
