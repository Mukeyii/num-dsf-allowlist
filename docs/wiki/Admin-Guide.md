# Admin Guide

## Becoming an Admin

Admin status is recorded in the `admin_grants` table, where each row is signed
(RS256) so a database-only attacker cannot grant themselves admin. There are two
ways a row gets there:

- **Bootstrap (first run only):** on the first backend start, emails listed in
  `IMI_ADMIN_EMAILS` are turned into signed grants. After that first run the env
  var is ignored — the table is authoritative. Remove it from production once the
  initial admins exist.

  ```
  IMI_ADMIN_EMAILS=admin1@example.com,admin2@example.com
  ```

- **Ongoing (4-eyes promotion):** an existing admin requests a promotion for a
  target user at `/app/admin/promotions`; a **second** admin from a different
  site must approve it (no silent consent). See ADR-001 (cryptographic admin
  grants) and ADR-003 (four-eyes approval).

## Administration pages

Admin-only pages are grouped under the collapsible **Administration** section in
the left sidebar (closed by default; all require admin + a TOTP step-up on
writes):

| Page | Path | Purpose |
|---|---|---|
| Approval Review | `/app/admin` | Action pending approval requests |
| User Management | `/app/admin/users` | Whitelist + lock/unlock/demote/remove |
| Promotions | `/app/admin/promotions` | Approve/reject admin-promotion requests |
| CA Blacklist | `/app/admin/ca-blacklist` | Distrusted CA issuer DNs/fingerprints |
| Bundle Versions | `/app/admin/bundle-versions` | Federation bundle history, diff, download |
| Audit Log | `/app/audit` | Append-only operations history |

## Approval Workflow

1. A site admin submits changes via "Send for Approval"
2. All IMI admins receive an email notification immediately
3. Open the **Approval Review** page (`/app/admin`)
4. Expand a pending request to see the full data snapshot
5. Enter your 6-digit authenticator code
6. Click **Approve** or **Reject** (rejection requires a comment)
7. Admins are notified immediately of the decision
8. Site contacts receive notification after 30 minutes (gives time to reverse)

## Email Whitelist

Manage who can log in:

```bash
# Add a user (seed script)
docker compose exec backend npx ts-node src/db/seed-whitelist.ts user@example.com

# Or via the Admin API (admin + TOTP)
POST   /api/v1/admin/users            { email, totpCode }   # add to whitelist
POST   /api/v1/admin/users/:email/lock    { reason, totpCode }
POST   /api/v1/admin/users/:email/unlock  { totpCode }
POST   /api/v1/admin/users/:email/demote  { totpCode }
DELETE /api/v1/admin/users/:email         { totpCode }       # remove from whitelist
```

## Certificate Renewal

When a certificate is expiring:
1. The site admin sees a warning banner and expiry timeline
2. Click "Renew" on the Certificates card
3. Select the expiring certificate
4. Upload or drag-drop the new PEM file
5. Review the comparison and confirm
6. Submit for approval to apply changes

## Monitoring

- **Audit Log** — `/app/audit` shows all changes with filters
- **Status Dashboard** — `/app/status` shows entity counts and expiry warnings
- **Activity Feed** — floating button shows recent changes in real-time
