-- Migration 010: pending_notifications table for persisting delayed-send emails
SET @table_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pending_notifications'
);
SET @sql := IF(@table_exists = 0,
  'CREATE TABLE pending_notifications (
     id            CHAR(36) PRIMARY KEY,
     kind          VARCHAR(64) NOT NULL,
     target_email  VARCHAR(255) NOT NULL,
     payload_json  JSON NOT NULL,
     send_after    TIMESTAMP NOT NULL,
     created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_pending_send_after (send_after)
   )',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
