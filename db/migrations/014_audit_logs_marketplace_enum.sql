-- 014_audit_logs_marketplace_enum.sql
-- Extend audit_logs.resource_type ENUM to include 'MARKETPLACE'.
--
-- audit.service writes resource_type='MARKETPLACE' for every plugin add /
-- update / remove (since migration 011), but the base schema's ENUM in
-- 001_initial_schema.sql did not list that value. MySQL coerces invalid
-- ENUM writes to the empty string with a warning, so marketplace events
-- silently lost their resource_type and disappeared from
-- ?resource=MARKETPLACE filter queries.
--
-- ALTER TABLE … MODIFY rewrites the column. On a 10k-row audit_logs table
-- this is a few seconds online (InnoDB online DDL); production deploys
-- can apply this without taking writes offline.

USE `dsf_allowlist`;

ALTER TABLE `audit_logs`
  MODIFY COLUMN `resource_type`
  ENUM(
    'ORGANIZATION',
    'CONTACT',
    'ENDPOINT',
    'CERTIFICATE',
    'MEMBERSHIP',
    'AUTH',
    'APPROVAL',
    'MARKETPLACE'
  ) NOT NULL;
