# Retention and Immutability

## audit_logs append-only triggers

Migration `013_audit_log_immutability.sql` adds two `BEFORE` triggers on `audit_logs`:

- `audit_logs_no_update` — fires on UPDATE, raises `SQLSTATE '45000'` with message
  `audit_logs is append-only; UPDATE is not permitted`.
- `audit_logs_no_delete` — fires on DELETE, raises `SQLSTATE '45000'` with message
  `audit_logs is append-only; DELETE is not permitted`.

The client receives error 1644 and the transaction aborts. This enforces the append-only
convention at the database layer; INSERT remains the only permitted mutation.

## endpoint / organization identifier immutability

Migration `015_endpoint_org_identifier_immutability.sql` adds `BEFORE UPDATE` triggers
`endpoints_identifier_immutable` and `organizations_identifier_immutable`. Each rejects
any UPDATE that changes `identifier` (the FQDN, the cross-tool federation key) with
`SQLSTATE '45000'`. Renames must be done by creating a new row and migrating references.

## membership soft-delete + 90-day hard-delete

- Migration `004_memberships_deleted_at.sql` adds `memberships.deleted_at` (nullable
  TIMESTAMP) plus index `idx_memberships_deleted_at`. Setting it marks a membership as
  removed; the next generated bundle emits a DELETE OrganizationAffiliation entry.
- The daily cron `runMembershipCleanup` (scheduler 09:00 UTC,
  `membership-cleanup.service.ts`) hard-deletes rows where `deleted_at` is older than
  `RETENTION_DAYS`. The retention window is `MEMBERSHIP_SOFT_DELETE_RETENTION_DAYS`,
  default `90`. The deletion is written to `audit_logs` as actor
  `SYSTEM:membership-cleanup`, operation DELETE.

## bundle_versions snapshot growth

Migration `017_bundle_versions.sql` persists a full FHIR bundle snapshot (`bundle_json`
LONGTEXT) on each approval transition to APPROVED, with `content_hash` (SHA-256) and an
RS256 `signature`. There is no automatic pruning — rows accumulate indefinitely to support
review, diff, download, and restore. Per the migration comment, each snapshot is ~50 KB;
10 years of weekly approvals is roughly 25 MB. `bundle_json` is LONGTEXT to hold bundles
beyond the MEDIUMTEXT 16-MB ceiling.

## pending_notifications 30-minute delayed delivery

Migration `010_pending_notifications.sql` creates `pending_notifications` so delayed-send
emails survive process restarts. On approve/reject, `notifySiteOnApproval`
(`approval-reminder.service.ts`) inserts a `SITE_APPROVAL` row with
`send_after = now + SITE_NOTIFY_DELAY_MS`. `SITE_NOTIFY_DELAY_MS` is `30 * MINUTE_MS`
(`lib/time.ts`), i.e. a fixed 30-minute delay. The scheduler runs `flushPendingNotifications`
every 5 minutes; rows with `send_after <= now` are sent and then removed. Admins are
notified immediately; the affected site receives its mail after the 30-minute delay.
