-- 002_client_cert_thumbprint.sql
-- Adds organizations.client_cert_thumbprint for mTLS authentication.
-- Idempotent: no-op if 001_initial_schema.sql already defined the column.

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'organizations'
    AND COLUMN_NAME = 'client_cert_thumbprint'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE organizations ADD COLUMN client_cert_thumbprint VARCHAR(128) DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
