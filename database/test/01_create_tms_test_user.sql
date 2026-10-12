-- TMS_TEST: an isolated schema for the scheduled-notification integration tests.
--
-- WHY: PKG_NOTIFICATION scans EVERY task in the schema it runs in, and it COMMITs internally,
-- so it cannot be rolled back and cannot be scoped to test rows. The only safe place to run it
-- is a schema that contains nothing but test data. This script creates that schema.
--
-- WHO: run ONCE by an Oracle administrator (SYSTEM, or SYS AS SYSDBA). The application user
-- TMS_USER has no CREATE USER privilege and is deliberately not given one.
--
-- WHAT IT DOES NOT DO: it grants nothing on TMS_USER's objects, creates no synonyms, and
-- gives TMS_TEST no way to see or change TMS_USER data. The privileges below are exactly the
-- ones TMS_USER has.
--
-- Usage (PowerShell), then see database/test/README.md for the next steps:
--   & "C:\app\wijdan\product\26ai\dbhomeFree\bin\sqlplus.exe" system@//localhost:1521/FREEPDB1 "@01_create_tms_test_user.sql"
--
-- You are prompted for the TMS_TEST password. It is never stored in this file; put it only in
-- backend/.env.test (git-ignored).

SET ECHO ON
SET VERIFY OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE

-- Safety: must be in the pluggable database, not the CDB root (a root user would need C##).
DECLARE
  v_con VARCHAR2(128) := SYS_CONTEXT('USERENV', 'CON_NAME');
BEGIN
  IF v_con <> 'FREEPDB1' THEN
    RAISE_APPLICATION_ERROR(-20001,
      'Connected to ' || v_con || '. Connect to FREEPDB1 (or run: ALTER SESSION SET CONTAINER = FREEPDB1;).');
  END IF;
END;
/

-- Safety: refuse to run if the schema already exists (so nothing is ever altered silently).
DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM dba_users WHERE username = 'TMS_TEST';
  IF v_count > 0 THEN
    RAISE_APPLICATION_ERROR(-20002, 'TMS_TEST already exists. Nothing was changed.');
  END IF;
END;
/

ACCEPT tms_test_password CHAR PROMPT 'Choose the TMS_TEST password: ' HIDE

CREATE USER tms_test IDENTIFIED BY "&tms_test_password"
  DEFAULT TABLESPACE users
  TEMPORARY TABLESPACE temp
  QUOTA 100M ON users;

GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE, CREATE VIEW, CREATE PROCEDURE TO tms_test;

PROMPT
PROMPT TMS_TEST created. Verify:
SELECT username, account_status, default_tablespace FROM dba_users WHERE username = 'TMS_TEST';
SELECT privilege FROM dba_sys_privs WHERE grantee = 'TMS_TEST' ORDER BY 1;
SELECT COUNT(*) AS object_grants_to_tms_test FROM dba_tab_privs WHERE grantee = 'TMS_TEST';

PROMPT
PROMPT Next: install the tables, packages and reference data AS tms_test (database/test/README.md).
