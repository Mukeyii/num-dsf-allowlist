-- 004_memberships_deleted_at.sql
-- Federation-safe allow-list: soft-delete on memberships so the next
-- generateFullBundle() emits DELETE OrganizationAffiliation entries.
-- Cleanup cron (membership-cleanup.service) hard-deletes rows older than 90 days.
-- Idempotent: no-op if column already exists.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'memberships'
    AND COLUMN_NAME = 'deleted_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE memberships ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'memberships'
    AND INDEX_NAME = 'idx_memberships_deleted_at'
);
SET @idx_sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_memberships_deleted_at ON memberships(deleted_at)',
  'SELECT 1'
);
PREPARE stmt2 FROM @idx_sql;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
