-- Migration 012: extra GitHub metadata on marketplace_entries

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'topics'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN topics JSON NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'forks'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN forks INT NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'open_issues'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN open_issues INT NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'archived'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'homepage'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN homepage VARCHAR(255) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'marketplace_entries' AND COLUMN_NAME = 'language'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE marketplace_entries ADD COLUMN language VARCHAR(50) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
