-- Migration 011: process marketplace
SET @table_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries'
);
SET @sql := IF(@table_exists = 0,
  'CREATE TABLE marketplace_entries (
     id                  CHAR(36)     PRIMARY KEY,
     git_url             VARCHAR(255) NOT NULL UNIQUE,
     name                VARCHAR(255) NOT NULL,
     description         TEXT         NULL,
     status              ENUM(''APPROVED'',''EXPERIMENTAL'',''DEPRECATED'') NOT NULL DEFAULT ''APPROVED'',
     latest_release_tag  VARCHAR(50)  NULL,
     last_commit_at      TIMESTAMP    NULL,
     stars               INT          NOT NULL DEFAULT 0,
     license             VARCHAR(50)  NULL,
     sync_at             TIMESTAMP    NULL,
     sync_error          TEXT         NULL,
     added_by            VARCHAR(255) NOT NULL,
     added_at            TIMESTAMP    NOT NULL,
     updated_at          TIMESTAMP    NOT NULL,
     INDEX idx_status (status),
     INDEX idx_sync_at (sync_at)
   )',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_type := (
  SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'audit_logs'
    AND COLUMN_NAME = 'resource_type'
);
SET @sql := IF(@col_type LIKE '%MARKETPLACE%', 'SELECT 1',
  "ALTER TABLE audit_logs MODIFY resource_type ENUM('ORGANIZATION','CONTACT','ENDPOINT','CERTIFICATE','MEMBERSHIP','AUTH','APPROVAL','MARKETPLACE') NOT NULL");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
