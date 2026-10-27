-- Migration 002 - Progress (formerly Subtasks): date/time column and two new permissions.
--
-- For a database that ALREADY holds real data. Additive and idempotent:
--   * ALTER TABLE subtasks ADD (progress_at TIMESTAMP): a NULLABLE column with no default.
--     Existing rows keep NULL ("Not set" in the UI); nothing is updated, deleted or dropped.
--     A second run reports ORA-01430 (column already exists) and carries on.
--   * Permissions PROGRESS_MANAGE and PROGRESS_TOGGLE and their role grants are added by
--     seed/rbac_data.sql, which is insert-only MERGE (existing rows are never changed).
--     SUBTASK_MANAGE and its grants are left exactly as they are (no longer checked by the app).
--       PROGRESS_MANAGE : create, edit, delete Progress items      -> ADMIN, MANAGER
--       PROGRESS_TOGGLE : mark an item completed / incomplete      -> ADMIN, MANAGER, MEMBER
--   * The table name SUBTASKS and the /subtasks API paths are unchanged on purpose.
--
-- Prerequisite: migration 001 has been applied (PERMISSIONS and ROLE_PERMISSIONS exist).
-- Run as the schema owner, from this directory:
--   sqlplus <schema_owner>@//<host>:1521/<service> @002_progress_datetime.sql
-- You are prompted for the password; do not put it on the command line or in this file.
-- Check the "connected_as" line below before you let it continue.
--
-- Oracle DDL commits implicitly, so this cannot be rolled back as a unit. That is safe because
-- every step is additive and a re-run completes whatever is missing.
SET ECHO ON
SET SERVEROUTPUT ON
SET DEFINE OFF
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

PROMPT == Pre-check: connected schema, prerequisites and current row counts
SELECT SYS_CONTEXT('USERENV','SESSION_USER') AS connected_as,
       SYS_CONTEXT('USERENV','CON_NAME')     AS container
  FROM dual;

DECLARE
  v_tables NUMBER;
  v_roles  NUMBER;
  v_rows   NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_tables FROM user_tables
   WHERE table_name IN ('SUBTASKS','PERMISSIONS','ROLE_PERMISSIONS','ROLES');
  IF v_tables <> 4 THEN
    RAISE_APPLICATION_ERROR(-20001,
      'SUBTASKS, PERMISSIONS, ROLE_PERMISSIONS and ROLES must exist (apply migration 001 first).');
  END IF;
  SELECT COUNT(*) INTO v_roles FROM roles WHERE role_name IN ('ADMIN','MANAGER','MEMBER');
  IF v_roles <> 3 THEN
    RAISE_APPLICATION_ERROR(-20002, 'ROLES must contain ADMIN, MANAGER and MEMBER.');
  END IF;
  SELECT COUNT(*) INTO v_rows FROM subtasks;
  DBMS_OUTPUT.PUT_LINE('Pre-check OK: ' || v_rows || ' existing subtask rows (left untouched).');
END;
/

PROMPT == Step 1: SUBTASKS.PROGRESS_AT (skipped when it already exists)
DECLARE
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE subtasks ADD (progress_at TIMESTAMP)';
  DBMS_OUTPUT.PUT_LINE('added   : SUBTASKS.PROGRESS_AT');
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -1430 THEN      -- ORA-01430: column being added already exists in table
      DBMS_OUTPUT.PUT_LINE('exists  : SUBTASKS.PROGRESS_AT (skipped)');
    ELSE
      RAISE;
    END IF;
END;
/

PROMPT == Step 2: permission catalogue and role grants (insert-only MERGE)
@@../seed/rbac_data.sql

PROMPT == Step 3: verification (read-only)
-- Expect 23 permissions; ADMIN 23, MANAGER 19, MEMBER 10 (52 grants in total).
SELECT 'permissions'      AS table_name, COUNT(*) AS row_count FROM permissions
UNION ALL SELECT 'role_permissions', COUNT(*) FROM role_permissions
UNION ALL SELECT 'subtasks (untouched)', COUNT(*) FROM subtasks
UNION ALL SELECT 'subtasks with a date/time', COUNT(progress_at) FROM subtasks;

SELECT r.role_name, p.permission_code
  FROM role_permissions rp
  JOIN roles r       ON r.role_id = rp.role_id
  JOIN permissions p ON p.permission_id = rp.permission_id
 WHERE p.permission_code IN ('PROGRESS_MANAGE','PROGRESS_TOGGLE')
 ORDER BY p.permission_code, r.role_name;

-- Must return no rows.
SELECT 'MISSING COLUMN: SUBTASKS.PROGRESS_AT' AS problem FROM dual
 WHERE NOT EXISTS (SELECT 1 FROM user_tab_columns
                    WHERE table_name = 'SUBTASKS' AND column_name = 'PROGRESS_AT');

PROMPT ================================================
PROMPT  Migration 002 finished. Safe to run again.
PROMPT ================================================
