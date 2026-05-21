-- 015_endpoint_org_identifier_immutability.sql
--
-- In a federated DSF environment, the endpoint/organization identifier (FQDN)
-- is the cross-tool primary key. If site A renames "dsf-fhir.example.de" to
-- "dsf.example.de", every other AllowList tool's bundle still references the
-- old value and federation breaks. Identifier MUST be treated as immutable.
--
-- Triggers enforce the rule at the DB layer so neither a service bug nor a
-- manual DBA UPDATE can desynchronise the federation. Application-level
-- guards exist for defence-in-depth, but the DB is the last line.

USE `dsf_allowlist`;

DELIMITER //

DROP TRIGGER IF EXISTS `endpoints_identifier_immutable`//
CREATE TRIGGER `endpoints_identifier_immutable`
BEFORE UPDATE ON `endpoints`
FOR EACH ROW
BEGIN
  IF NEW.identifier <> OLD.identifier THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'endpoints.identifier is immutable; create a new endpoint and migrate memberships instead';
  END IF;
END//

DROP TRIGGER IF EXISTS `organizations_identifier_immutable`//
CREATE TRIGGER `organizations_identifier_immutable`
BEFORE UPDATE ON `organizations`
FOR EACH ROW
BEGIN
  IF NEW.identifier <> OLD.identifier THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'organizations.identifier is immutable; create a new organization instead';
  END IF;
END//

DELIMITER ;
