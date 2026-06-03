import type { Page } from '@playwright/test';

// nginx rate-limits /auth at 5r/min + burst 3 in real envs; tests sharing a
// worker can briefly exceed that window. In CI the workflow strips `limit_req`
// from nginx.conf before docker-compose up, so the retry loop only needs to
// cover transient browser/navigation flakes — a multi-second backoff there
// just races Playwright's 30s test timeout. Locally we still want a real
// backoff to wait the rate-limit window out.
const RATE_LIMIT_BACKOFF_MS = process.env.CI ? 500 : 15_000;

/**
 * Logs in via the dev-login URL shortcut (DEV_AUTO_LOGIN=true on backend).
 * AuthBootstrap.tsx handles ?devRole=… by clearing auth + calling /auth/dev-login.
 */
export async function loginAs(
  page: Page,
  role: 'admin' | 'member' | 'site' = 'admin',
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`/?devRole=${role}`);
    try {
      await page.waitForURL(/\/app/, { timeout: 10_000 });
      await page.waitForLoadState('networkidle');
      return;
    } catch {
      if (attempt === 2) throw new Error(`loginAs(${role}) gave up after 3 attempts`);
      await page.waitForTimeout(RATE_LIMIT_BACKOFF_MS);
    }
  }
}
