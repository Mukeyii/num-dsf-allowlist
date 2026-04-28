-- 005_email_whitelist_lock.sql
-- Adds lock lifecycle to email_whitelist for admin-managed user disabling.
-- Idempotent: no-op if columns already exist.

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_whitelist' AND COLUMN_NAME = 'locked_at');
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE email_whitelist
     ADD COLUMN locked_at TIMESTAMP NULL DEFAULT NULL,
     ADD COLUMN locked_by VARCHAR(255) NULL DEFAULT NULL,
     ADD COLUMN locked_reason TEXT NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
