-- Migration 003 - Progress: separate Start and End date/time (replaces the single PROGRESS_AT).
--
-- For a database that ALREADY holds real data. Additive and idempotent:
--   * ALTER TABLE subtasks ADD (start_at TIMESTAMP, end_at TIMESTAMP): NULLABLE, no default.
--   * Existing rows: START_AT is copied from PROGRESS_AT (only where START_AT is still NULL);
--     END_AT stays NULL ("Not set" in the UI until a manager edits the item).
--     IS_COMPLETED, TITLE, SORT_ORDER and every other column are never touched.
--   * CK_SUBTASKS_END_AFTER_START: END_AT must be later than START_AT whenever both are set.
--     NULLs are allowed so older rows stay valid; the API requires both for new/edited items.
--   * PROGRESS_AT is NOT dropped or renamed. The app no longer writes it; the API still returns
--     its value as the read-only alias "progressAt" (= startAt).
--   * No permission changes: PROGRESS_MANAGE / PROGRESS_TOGGLE and their grants stay as they are.
--
-- Prerequisite: migration 002 has been applied (SUBTASKS.PROGRESS_AT exists).
-- Run as the schema owner, from this directory:
--   sqlplus <schema_owner>@//<host>:1521/<service> @003_progress_start_end.sql
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
  v_col  NUMBER;
  v_rows NUMBER;
  v_done NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_col FROM user_tab_columns
   WHERE table_name = 'SUBTASKS' AND column_name = 'PROGRESS_AT';
  IF v_col <> 1 THEN
    RAISE_APPLICATION_ERROR(-20001, 'SUBTASKS.PROGRESS_AT must exist (apply migration 002 first).');
  END IF;
  SELECT COUNT(*), NVL(SUM(CASE WHEN is_completed = 'Y' THEN 1 ELSE 0 END), 0)
    INTO v_rows, v_done FROM subtasks;
  DBMS_OUTPUT.PUT_LINE('Pre-check OK: ' || v_rows || ' progress rows, ' || v_done ||
                       ' completed (both counts must be unchanged afterwards).');
END;
/

PROMPT == Step 1: SUBTASKS.START_AT and SUBTASKS.END_AT (each skipped when it already exists)
DECLARE
  PROCEDURE add_col(p_name VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE subtasks ADD (' || p_name || ' TIMESTAMP)';
    DBMS_OUTPUT.PUT_LINE('added   : SUBTASKS.' || UPPER(p_name));
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE = -1430 THEN      -- ORA-01430: column being added already exists in table
        DBMS_OUTPUT.PUT_LINE('exists  : SUBTASKS.' || UPPER(p_name) || ' (skipped)');
      ELSE
        RAISE;
      END IF;
  END;
BEGIN
  add_col('start_at');
  add_col('end_at');
END;
/

PROMPT == Step 2: carry existing PROGRESS_AT into START_AT (only rows not yet filled)
DECLARE
  v_n NUMBER;
BEGIN
  UPDATE subtasks SET start_at = progress_at
   WHERE start_at IS NULL AND progress_at IS NOT NULL;
  v_n := SQL%ROWCOUNT;
  COMMIT;
  DBMS_OUTPUT.PUT_LINE('copied  : ' || v_n || ' row(s) PROGRESS_AT -> START_AT');
END;
/

PROMPT == Step 3: CK_SUBTASKS_END_AFTER_START (skipped when it already exists)
DECLARE
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE subtasks ADD CONSTRAINT ck_subtasks_end_after_start '
                 || 'CHECK (start_at IS NULL OR end_at IS NULL OR end_at > start_at)';
  DBMS_OUTPUT.PUT_LINE('added   : CK_SUBTASKS_END_AFTER_START');
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -2264 OR SQLCODE = -2260 THEN   -- name already used / table already has constraint
      DBMS_OUTPUT.PUT_LINE('exists  : CK_SUBTASKS_END_AFTER_START (skipped)');
    ELSE
      RAISE;
    END IF;
END;
/

PROMPT == Step 4: verification (read-only)
SELECT 'subtasks (total, unchanged)'    AS check_name, COUNT(*) AS row_count FROM subtasks
UNION ALL SELECT 'completed (unchanged)',           COUNT(*) FROM subtasks WHERE is_completed = 'Y'
UNION ALL SELECT 'with PROGRESS_AT',                COUNT(progress_at) FROM subtasks
UNION ALL SELECT 'with START_AT',                   COUNT(start_at)    FROM subtasks
UNION ALL SELECT 'with END_AT (legacy rows: 0)',    COUNT(end_at)      FROM subtasks;

-- Must return no rows.
SELECT 'PROGRESS_AT NOT CARRIED TO START_AT: ' || subtask_id AS problem FROM subtasks
 WHERE progress_at IS NOT NULL AND start_at IS NULL
UNION ALL
SELECT 'MISSING COLUMN: SUBTASKS.' || c FROM (SELECT 'START_AT' c FROM dual UNION ALL SELECT 'END_AT' FROM dual) x
 WHERE NOT EXISTS (SELECT 1 FROM user_tab_columns WHERE table_name = 'SUBTASKS' AND column_name = x.c)
UNION ALL
SELECT 'MISSING CONSTRAINT: CK_SUBTASKS_END_AFTER_START' FROM dual
 WHERE NOT EXISTS (SELECT 1 FROM user_constraints WHERE constraint_name = 'CK_SUBTASKS_END_AFTER_START');

PROMPT ================================================
PROMPT  Migration 003 finished. Safe to run again.
PROMPT ================================================
