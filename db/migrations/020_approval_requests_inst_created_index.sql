-- 020_approval_requests_inst_created_index.sql
-- Composite (instance_id, created_at) index for approval_requests.
-- The federation services (fhir/network/excel) resolve each org's latest
-- approval status with a correlated subquery filtered by instance_id and
-- ordered by created_at DESC. A single-column instance_id index still forces
-- a filesort per org; the composite covers both the filter and the order.
-- Idempotent: no-op if the index already exists.

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'approval_requests'
    AND INDEX_NAME = 'idx_ar_inst_created'
);
SET @idx_sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_ar_inst_created ON approval_requests(instance_id, created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
