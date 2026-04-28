-- 007_admin_promotion_requests.sql
-- 4-eyes promotion workflow: requester (1st approver) creates a request;
-- a second admin from a different site must explicitly approve OR reject.
-- No silent-consent timer. Idempotent.

SET @t := (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_promotion_requests');
SET @sql := IF(@t = 0,
  'CREATE TABLE admin_promotion_requests (
     id               CHAR(36) PRIMARY KEY,
     target_email     VARCHAR(255) NOT NULL,
     requested_by     VARCHAR(255) NOT NULL,
     requested_at     TIMESTAMP NOT NULL,
     status           ENUM("PENDING","APPROVED","REJECTED","CANCELLED") NOT NULL DEFAULT "PENDING",
     approver_b       VARCHAR(255) NULL,
     approved_at      TIMESTAMP NULL,
     rejected_by      VARCHAR(255) NULL,
     rejection_reason TEXT NULL,
     resolved_at      TIMESTAMP NULL
   )',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_promotion_requests' AND INDEX_NAME = 'idx_apr_status');
SET @isql := IF(@i = 0,
  'CREATE INDEX idx_apr_status ON admin_promotion_requests(status)',
  'SELECT 1');
PREPARE stmt2 FROM @isql; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
