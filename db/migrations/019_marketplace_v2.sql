-- Migration 019: marketplace v2 — DSF metadata, trust signals, releases

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'slug'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN slug VARCHAR(255) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'process_identifiers'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN process_identifiers JSON NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'dsf_version_min'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN dsf_version_min VARCHAR(20) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'required_roles'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN required_roles JSON NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'message_names'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN message_names JSON NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'artifact_url'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN artifact_url VARCHAR(500) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'metadata_source'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE marketplace_entries ADD COLUMN metadata_source ENUM('MANIFEST','MANUAL') NOT NULL DEFAULT 'MANUAL'",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'manifest_error'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN manifest_error TEXT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'verified'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN verified TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'advisory_text'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN advisory_text TEXT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'advisory_severity'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE marketplace_entries ADD COLUMN advisory_severity ENUM('INFO','WARNING','CRITICAL') NULL",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'superseded_by'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN superseded_by VARCHAR(255) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill slug from the canonical owner/repo path; one-time for existing rows.
UPDATE marketplace_entries
SET slug = LOWER(REPLACE(SUBSTRING_INDEX(git_url, 'github.com/', -1), '/', '-'))
WHERE slug IS NULL;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND INDEX_NAME = 'uq_mp_slug'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE marketplace_entries ADD UNIQUE INDEX uq_mp_slug (slug)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @table_exists := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_releases'
);
SET @sql := IF(@table_exists = 0,
  'CREATE TABLE marketplace_releases (
     id           CHAR(36)     PRIMARY KEY,
     entry_id     CHAR(36)     NOT NULL,
     tag          VARCHAR(100) NOT NULL,
     published_at TIMESTAMP    NULL,
     CONSTRAINT fk_mp_rel_entry FOREIGN KEY (entry_id) REFERENCES marketplace_entries(id) ON DELETE CASCADE,
     UNIQUE KEY uq_entry_tag (entry_id, tag)
   )',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
