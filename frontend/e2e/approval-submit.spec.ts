import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

/**
 * E2E for the submit-for-approval surface — the user-facing "I'm done editing"
 * action. Phase 2 covered admin gating + marketplace add but not this flow.
 *
 * The seed creates a `site` user with an unsubmitted draft instance. We verify
 * the Submit button is present (gated on having a draft + the right role)
 * which is the structural invariant that breaks if the approval card is
 * accidentally chrome-hidden on /app for non-dashboard pages.
 */
test('site user sees the Send-for-Approval action on /app', async ({ page }) => {
  test.setTimeout(60_000);
  await loginAs(page, 'site');
  // TopBar renders the "Send for Approval" button when the active instance is
  // a submittable draft. The site user fixture has exactly that.
  const submitBtn = page.getByRole('button', { name: /send for approval|zur prüfung|zur freigabe/i });
  await expect(submitBtn).toBeVisible({ timeout: 15_000 });
});
