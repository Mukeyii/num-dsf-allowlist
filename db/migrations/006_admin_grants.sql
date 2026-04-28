-- 006_admin_grants.sql
-- Cryptographically signed admin role assignments. App verifies RS256
-- signature over canonical message; DB-only attacker can't forge.
-- Idempotent.

SET @t := (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_grants');
SET @sql := IF(@t = 0,
  'CREATE TABLE admin_grants (
     email          VARCHAR(255) PRIMARY KEY,
     granted_at     TIMESTAMP NOT NULL,
     granted_by_a   VARCHAR(255) NOT NULL,
     granted_by_b   VARCHAR(255) NOT NULL,
     signature_hex  TEXT NOT NULL
   )',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_grants' AND INDEX_NAME = 'idx_admin_grants_granted_at');
SET @isql := IF(@i = 0,
  'CREATE INDEX idx_admin_grants_granted_at ON admin_grants(granted_at)',
  'SELECT 1');
PREPARE stmt2 FROM @isql; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
