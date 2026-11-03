-- Migration 004 - TASKS.COMPLETED_AT (user performance evaluation).
--
-- Additive and idempotent: adds one nullable DATE column to TASKS. No row is updated, so tasks
-- that are already COMPLETED keep completed_at = NULL and are reported as "Not evaluable" by
-- /api/performance. There is no status history to recover the real date from, and an invented
-- one would corrupt the schedule figures, so no backfill is done on purpose.
-- The column definition must stay identical to ddl/04_tasks.sql.
--
-- Run as the schema owner:
--   sqlplus <schema_owner>@//<host>:1521/<service> @004_task_completed_at.sql
SET ECHO ON
SET SERVEROUTPUT ON
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK

DECLARE
BEGIN
  EXECUTE IMMEDIATE 'ALTER TABLE tasks ADD (completed_at DATE)';
  DBMS_OUTPUT.PUT_LINE('created : TASKS.COMPLETED_AT');
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE = -1430 THEN      -- ORA-01430: column being added already exists in table
      DBMS_OUTPUT.PUT_LINE('exists  : TASKS.COMPLETED_AT (skipped)');
    ELSE
      RAISE;
    END IF;
END;
/
