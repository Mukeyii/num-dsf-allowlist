-- 008_approval_request_last_reminded_at.sql
-- Idempotently add last_reminded_at to approval_requests to throttle cron reminders.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'approval_requests'
    AND COLUMN_NAME = 'last_reminded_at'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE approval_requests ADD COLUMN last_reminded_at TIMESTAMP NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
