import type { Page } from '@playwright/test';

/**
 * Logs in via the dev-login URL shortcut (DEV_AUTO_LOGIN=true on backend).
 * AuthBootstrap.tsx handles ?devRole=… by clearing auth + calling /auth/dev-login.
 */
export async function loginAs(page: Page, role: 'admin' | 'member' | 'site' = 'admin'): Promise<void> {
  // Retry on 429: nginx rate-limits /auth at 5r/min + burst 3. Tests sharing
  // a worker can briefly exceed that window; back off and try again.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`/?devRole=${role}`);
    try {
      await page.waitForURL(/\/app/, { timeout: 10_000 });
      await page.waitForLoadState('networkidle');
      return;
    } catch {
      if (attempt === 2) throw new Error(`loginAs(${role}) gave up after 3 attempts`);
      await page.waitForTimeout(15_000); // wait for the nginx auth rate-limit window to drain
    }
  }
}
