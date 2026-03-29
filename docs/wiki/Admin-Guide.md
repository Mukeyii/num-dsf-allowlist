# Admin Guide

## Becoming an Admin

Add your email to the `IMI_ADMIN_EMAILS` environment variable (comma-separated):

```
IMI_ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

Restart the backend after changes.

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
# Add a user
docker compose exec backend npx ts-node src/db/seed-whitelist.ts user@example.com

# Or via Admin API
POST /api/v1/admin/whitelist
Body: { "email": "user@example.com" }
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
