import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

/**
 * Page-level visual regression baselines.
 *
 * Catches re-introduction of dashboard-only chrome (cert-expiry banner,
 * right panel, approval / download buttons, search bar) onto pages that
 * shouldn't have them. Snapshots taken on the official Playwright Linux
 * image so they match CI's ubuntu-latest runner.
 */

test.describe('page-level visual regression', () => {
  test('marketplace has no dashboard chrome', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/app/marketplace');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('marketplace.png', {
      maxDiffPixelRatio: 0.05,
      fullPage: false,
    });
  });

  test('audit page has no dashboard chrome', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/app/audit');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('audit.png', { maxDiffPixelRatio: 0.05 });
  });

  test('admin users page has no dashboard chrome', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/app/admin/users');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('admin-users.png', { maxDiffPixelRatio: 0.05 });
  });
});
