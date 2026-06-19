-- 013_audit_log_immutability.sql
-- Enforce append-only semantics on audit_logs at the DB level.
--
-- Until now the no-UPDATE / no-DELETE rule on audit_logs
-- was a convention only — any service holding DB_USER credentials, or any
-- future regression in the writer code, could violate it silently. These
-- triggers turn that convention into a hard SQL constraint.
--
-- SIGNAL SQLSTATE '45000' rejects the statement with an explicit message;
-- the client receives a 1644 error and the transaction is aborted.

USE `dsf_allowlist`;

DELIMITER //

DROP TRIGGER IF EXISTS `audit_logs_no_update`//
CREATE TRIGGER `audit_logs_no_update`
BEFORE UPDATE ON `audit_logs`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'audit_logs is append-only; UPDATE is not permitted';
END//

DROP TRIGGER IF EXISTS `audit_logs_no_delete`//
CREATE TRIGGER `audit_logs_no_delete`
BEFORE DELETE ON `audit_logs`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'audit_logs is append-only; DELETE is not permitted';
END//

DELIMITER ;
