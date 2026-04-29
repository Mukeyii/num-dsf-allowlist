import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test('admin can add a marketplace entry through the UI', async ({ page }) => {
  test.setTimeout(120_000); // accommodate retry/back-off in loginAs
  await loginAs(page, 'admin');
  // Navigate via sidebar link so AuthBootstrap doesn't remount and lose the
  // freshly-set admin auth state.
  await page.getByRole('link', { name: /marketplace|marktplatz/i }).click();
  await page.waitForURL(/\/app\/marketplace/);
  await page.waitForLoadState('networkidle');

  // The Add button is admin-gated. Wait for it explicitly so we don't race the
  // /auth/me settle that drives `me?.isAdmin` in the page.
  const addBtn = page.getByRole('button', { name: /add process|prozess hinzufügen/i });
  await expect(addBtn).toBeVisible({ timeout: 30_000 });
  await addBtn.click();

  const url = `https://github.com/example/e2e-test-${Date.now()}`;
  // FormField doesn't pair <label htmlFor> with input id, so getByLabel won't
  // resolve. Match the placeholders the modal renders instead.
  await page.getByPlaceholder('https://github.com/owner/repo').fill(url);
  await page.getByPlaceholder('000000').fill('123456'); // TOTP – bypassed in dev

  // The modal footer's primary button reuses the marketplaceAdd label. Scope
  // the click to the dialog so we don't re-click the page-level "Add process".
  await page.getByRole('dialog').getByRole('button', { name: /add process|prozess hinzufügen/i }).click();

  // Marketplace renders entries as anchors with href = gitUrl. Match by href.
  await expect(page.locator(`a[href="${url}"]`)).toBeVisible({ timeout: 8_000 });
});
