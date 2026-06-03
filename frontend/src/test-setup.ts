/**
 * test-setup.ts – Vitest setup file.
 * Loaded once before each test file via vite.config.ts `setupFiles`.
 * Adds jest-dom matchers to expect, and clears localStorage after every test
 * so persisted UI state (theme, language) cannot leak between tests.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

afterEach(() => {
  localStorage.clear();
});
