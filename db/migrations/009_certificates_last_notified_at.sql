-- 009_certificates_last_notified_at.sql
-- Idempotently add last_notified_at to certificates to prevent duplicate daily notifications.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'certificates'
    AND COLUMN_NAME = 'last_notified_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE certificates ADD COLUMN last_notified_at TIMESTAMP NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
