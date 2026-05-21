/**
 * notification-urls.test.ts — guard against linking to non-existent admin
 * routes. The router exposes /app/admin, not /admin/approvals.
 *
 * Dependencies: fs (read-only source scan).
 */
import fs from 'fs';
import path from 'path';

describe('notification.service URL hygiene', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'notification.service.ts'),
    'utf8',
  );

  it('never links to the non-existent /admin/approvals path', () => {
    expect(src).not.toMatch(/\/admin\/approvals/);
  });

  it('uses /app/admin for admin-facing approval links', () => {
    expect(src).toMatch(/\/app\/admin/);
  });
});
