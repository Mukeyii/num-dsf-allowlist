import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { loginAs } from './fixtures/auth';

test('admin can reach the dashboard via dev-login', async ({ page }) => {
  await loginAs(page, 'admin');
  await expect(page).toHaveURL(/\/app/);
});

test('login page has no critical/serious a11y violations', async ({ page }) => {
  await page.goto('/login');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  if (blocking.length > 0) {
    console.log(
      'A11y violations on /login:',
      JSON.stringify(
        blocking.map((v) => ({ id: v.id, impact: v.impact, description: v.description })),
        null,
        2,
      ),
    );
  }
  expect(blocking).toEqual([]);
});
