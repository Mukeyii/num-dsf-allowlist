-- Federation-safe allow-list: soft-delete on memberships so the next
-- generateFullBundle() emits DELETE OrganizationAffiliation entries.
-- Cleanup cron (membership-cleanup.service) hard-deletes rows older than 90 days.

ALTER TABLE memberships ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
CREATE INDEX idx_memberships_deleted_at ON memberships(deleted_at);
