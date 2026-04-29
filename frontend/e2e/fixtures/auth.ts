import type { Page } from '@playwright/test';

/**
 * Logs in via the dev-login URL shortcut (DEV_AUTO_LOGIN=true on backend).
 * AuthBootstrap.tsx handles ?devRole=… by clearing auth + calling /auth/dev-login.
 */
export async function loginAs(page: Page, role: 'admin' | 'member' | 'site' = 'admin'): Promise<void> {
  await page.goto(`/?devRole=${role}`);
  await page.waitForURL(/\/app/, { timeout: 10_000 });
}
