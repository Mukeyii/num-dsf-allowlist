-- 4-eyes approval workflow: every admin sign-off / rejection lives here.
-- The parent approval_requests.status is derived from these signatures
-- (computed in backend/src/lib/approvalState.ts).
-- Idempotent: no-op if table/indexes already exist.

SET @tbl_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'approval_signatures'
);
SET @create_sql := IF(@tbl_exists = 0,
  'CREATE TABLE approval_signatures (
    id                  CHAR(36) PRIMARY KEY,
    approval_request_id CHAR(36) NOT NULL,
    admin_email         VARCHAR(255) NOT NULL,
    admin_site          VARCHAR(255) NOT NULL,
    decision            ENUM(''APPROVE'',''REJECT'') NOT NULL,
    signed_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    comment             TEXT,
    CONSTRAINT fk_signatures_request FOREIGN KEY (approval_request_id)
      REFERENCES approval_requests(id) ON DELETE CASCADE,
    CONSTRAINT uq_signatures_request_admin UNIQUE (approval_request_id, admin_email)
  )',
  'SELECT 1'
);
PREPARE stmt FROM @create_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx1_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'approval_signatures'
    AND INDEX_NAME = 'idx_signatures_request'
);
SET @idx1_sql := IF(@idx1_exists = 0,
  'CREATE INDEX idx_signatures_request ON approval_signatures(approval_request_id)',
  'SELECT 1'
);
PREPARE stmt2 FROM @idx1_sql;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @idx2_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'approval_signatures'
    AND INDEX_NAME = 'idx_signatures_decision'
);
SET @idx2_sql := IF(@idx2_exists = 0,
  'CREATE INDEX idx_signatures_decision ON approval_signatures(decision)',
  'SELECT 1'
);
PREPARE stmt3 FROM @idx2_sql;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;
