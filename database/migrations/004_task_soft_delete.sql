-- Migration 004 - Soft delete and Recycle Bin for tasks.
--
-- For a database that ALREADY holds real data. Additive and idempotent:
--   * TASKS gets IS_DELETED (CHAR(1) DEFAULT 'N' NOT NULL), DELETED_AT and DELETED_BY. Every
--     existing row becomes IS_DELETED = 'N' with NULL DELETED_AT / DELETED_BY: nothing is deleted,
--     hidden, rewritten or moved. Oracle applies a constant NOT NULL default to existing rows as
--     a metadata change, so no table rewrite and no row is touched.
--   * Constraints: IS_DELETED IN ('Y','N'); a row is either live (both DELETED_* NULL) or deleted
--     (both set); DELETED_BY references USERS (no cascade).
--   * Indexes IX_TASKS_DELETED (is_deleted, project_id) and IX_TASKS_DELETED_BY.
--   * New append-only table TASK_AUDIT_LOG (deletion / restoration history). No foreign key to
--     TASKS or PROJECTS on purpose: the history outlives them.
--   * RBAC: new permissions TASK_RESTORE and RECYCLE_BIN_VIEW, granted to ADMIN and MANAGER, written
--     inline below as MERGE ... WHEN NOT MATCHED THEN INSERT (never updates or removes a row; same
--     rows as seed/rbac_data.sql). After this migration: 25 permissions, 56 role_permissions.
--   * PKG_DASHBOARD and PKG_NOTIFICATION must be re-created so deleted tasks drop out of every
--     dashboard figure and never raise a reminder. This script does NOT load other files (a
--     relative @@../ path depends on where sqlplus was started and fails with SP2-0310). Run the
--     package install as the second command below; the final verification here FAILS until then.
--   * Nothing is dropped, truncated or deleted. Permanent task deletion is NOT introduced.
--
-- Deploy order: run this migration BEFORE starting the new backend (the new code reads
-- TASKS.IS_DELETED and the new permissions). The previous backend keeps working against the
-- migrated schema, except that its DELETE still removes rows for good.
--
-- Prerequisites: migrations 001-003 applied (PERMISSIONS, ROLE_PERMISSIONS, SUBTASKS.START_AT).
-- Run as the schema owner. Each command is run from the directory that holds its script, so no
-- path is ever resolved relative to anything else:
--   cd <repo>/database/migrations
--   sqlplus <schema_owner>@//<host>:1521/<service> @004_task_soft_delete.sql
--   cd <repo>/database/plsql
--   sqlplus <schema_owner>@//<host>:1521/<service> @run_all.sql
--   cd <repo>/database/migrations
--   sqlplus <schema_owner>@//<host>:1521/<service> @004_task_soft_delete.sql      (again)
-- The first run stops with ORA-20004 at the verification if the packages are still the old
-- version; that is expected. The last run is idempotent and must end with "Migration 004
-- verified". Any other ORA-20004 message names exactly what is wrong.
-- You are prompted for the password; do not put it on the command line or in this file.
-- Check the "connected_as" line below before you let it continue: it must be the schema you mean
-- to migrate. For tests that is TMS_TEST; never run this against another schema by accident.
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

-- Row-count snapshot, compared with the counts after the migration (substitution variables).
COLUMN c_tasks NEW_VALUE pre_tasks NOPRINT
COLUMN c_sub   NEW_VALUE pre_sub   NOPRINT
COLUMN c_com   NEW_VALUE pre_com   NOPRINT
COLUMN c_att   NEW_VALUE pre_att   NOPRINT
COLUMN c_asg   NEW_VALUE pre_asg   NOPRINT
SELECT (SELECT COUNT(*) FROM tasks)          AS c_tasks,
       (SELECT COUNT(*) FROM subtasks)       AS c_sub,
       (SELECT COUNT(*) FROM comments)       AS c_com,
       (SELECT COUNT(*) FROM attachments)    AS c_att,
       (SELECT COUNT(*) FROM task_assignees) AS c_asg
  FROM dual;

DECLARE
  v_missing VARCHAR2(500);
  v_tasks   NUMBER;
  v_sub     NUMBER;
  v_com     NUMBER;
  v_att     NUMBER;
  v_asg     NUMBER;
BEGIN
  FOR r IN (SELECT t.name FROM (SELECT 'TASKS' name FROM dual UNION ALL SELECT 'USERS' FROM dual
                                UNION ALL SELECT 'PERMISSIONS' FROM dual
                                UNION ALL SELECT 'ROLE_PERMISSIONS' FROM dual
                                UNION ALL SELECT 'ROLES' FROM dual) t
             WHERE NOT EXISTS (SELECT 1 FROM user_tables u WHERE u.table_name = t.name)) LOOP
    v_missing := v_missing || ' ' || r.name;
  END LOOP;
  IF v_missing IS NOT NULL THEN
    RAISE_APPLICATION_ERROR(-20001, 'Missing prerequisite table(s):' || v_missing ||
                            ' (apply migrations 001-003 first).');
  END IF;
  SELECT COUNT(*) INTO v_tasks FROM tasks;
  SELECT COUNT(*) INTO v_sub   FROM subtasks;
  SELECT COUNT(*) INTO v_com   FROM comments;
  SELECT COUNT(*) INTO v_att   FROM attachments;
  SELECT COUNT(*) INTO v_asg   FROM task_assignees;
  DBMS_OUTPUT.PUT_LINE('Pre-check OK: tasks=' || v_tasks || ' subtasks=' || v_sub ||
                       ' comments=' || v_com || ' attachments=' || v_att ||
                       ' assignees=' || v_asg || ' (all counts must be unchanged afterwards).');
END;
/

PROMPT == Step 1: TASKS.IS_DELETED, DELETED_AT, DELETED_BY (each skipped when it already exists)
DECLARE
  PROCEDURE add_col(p_name VARCHAR2, p_def VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE tasks ADD (' || p_name || ' ' || p_def || ')';
    DBMS_OUTPUT.PUT_LINE('added   : TASKS.' || UPPER(p_name));
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE = -1430 THEN      -- ORA-01430: column being added already exists in table
        DBMS_OUTPUT.PUT_LINE('exists  : TASKS.' || UPPER(p_name) || ' (skipped)');
      ELSE
        RAISE;
      END IF;
  END;
BEGIN
  add_col('is_deleted', 'CHAR(1) DEFAULT ''N'' NOT NULL');
  add_col('deleted_at', 'TIMESTAMP');
  add_col('deleted_by', 'NUMBER');
END;
/

PROMPT == Step 2: constraints (each skipped when it already exists)
DECLARE
  PROCEDURE add_con(p_name VARCHAR2, p_ddl VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE tasks ADD CONSTRAINT ' || p_name || ' ' || p_ddl;
    DBMS_OUTPUT.PUT_LINE('added   : ' || UPPER(p_name));
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE IN (-2264, -2260, -2275) THEN   -- name used / table has it / FK already exists
        DBMS_OUTPUT.PUT_LINE('exists  : ' || UPPER(p_name) || ' (skipped)');
      ELSE
        RAISE;
      END IF;
  END;
BEGIN
  add_con('ck_tasks_deleted_flag', 'CHECK (is_deleted IN (''Y'',''N''))');
  add_con('ck_tasks_deleted_consistent',
          'CHECK ((is_deleted = ''N'' AND deleted_at IS NULL AND deleted_by IS NULL) OR '
       || '(is_deleted = ''Y'' AND deleted_at IS NOT NULL AND deleted_by IS NOT NULL))');
  add_con('fk_tasks_deleted_by', 'FOREIGN KEY (deleted_by) REFERENCES users (user_id)');
END;
/

PROMPT == Step 3: indexes (each skipped when it already exists)
DECLARE
  PROCEDURE add_idx(p_name VARCHAR2, p_ddl VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE 'CREATE INDEX ' || p_name || ' ON ' || p_ddl;
    DBMS_OUTPUT.PUT_LINE('created : ' || UPPER(p_name));
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE = -955 OR SQLCODE = -1408 THEN    -- name already used / column list indexed
        DBMS_OUTPUT.PUT_LINE('exists  : ' || UPPER(p_name) || ' (skipped)');
      ELSE
        RAISE;
      END IF;
  END;
BEGIN
  add_idx('ix_tasks_deleted',    'tasks (is_deleted, project_id)');
  add_idx('ix_tasks_deleted_by', 'tasks (deleted_by)');
END;
/

PROMPT == Step 4: TASK_AUDIT_LOG (skipped when it already exists; must match ddl/10_task_audit.sql)
DECLARE
  PROCEDURE run_ddl(p_label VARCHAR2, p_sql VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE p_sql;
    DBMS_OUTPUT.PUT_LINE('created : ' || p_label);
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE = -955 OR SQLCODE = -1408 THEN
        DBMS_OUTPUT.PUT_LINE('exists  : ' || p_label || ' (skipped)');
      ELSE
        RAISE;
      END IF;
  END;
BEGIN
  run_ddl('TASK_AUDIT_LOG',
    'CREATE TABLE task_audit_log ('
 || ' audit_id   NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,'
 || ' task_id    NUMBER        NOT NULL,'
 || ' project_id NUMBER        NOT NULL,'
 || ' task_title VARCHAR2(200) NOT NULL,'
 || ' action     VARCHAR2(10)  NOT NULL,'
 || ' actor_id   NUMBER        NOT NULL,'
 || ' acted_at   TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,'
 || ' details    VARCHAR2(1000),'
 || ' CONSTRAINT ck_task_audit_action CHECK (action IN (''DELETE'',''RESTORE'')),'
 || ' CONSTRAINT fk_task_audit_actor  FOREIGN KEY (actor_id) REFERENCES users (user_id))');
  run_ddl('IX_TASK_AUDIT_TASK',    'CREATE INDEX ix_task_audit_task ON task_audit_log (task_id, acted_at)');
  run_ddl('IX_TASK_AUDIT_PROJECT', 'CREATE INDEX ix_task_audit_project ON task_audit_log (project_id, acted_at)');
  run_ddl('IX_TASK_AUDIT_ACTOR',   'CREATE INDEX ix_task_audit_actor ON task_audit_log (actor_id)');
END;
/

PROMPT == Step 5: RBAC grants (MERGE ... WHEN NOT MATCHED only; existing rows are never changed)
MERGE INTO permissions p
USING (
  SELECT 'TASK_RESTORE' AS permission_code,
         'Restore a soft-deleted task; managers of its project and ADMIN' AS description FROM dual UNION ALL
  SELECT 'RECYCLE_BIN_VIEW',
         'View the Recycle Bin (soft-deleted tasks); managers and ADMIN' FROM dual
) src
ON (p.permission_code = src.permission_code)
WHEN NOT MATCHED THEN
  INSERT (permission_code, description) VALUES (src.permission_code, src.description);

MERGE INTO role_permissions rp
USING (
  SELECT r.role_id, p.permission_id
    FROM (SELECT 'ADMIN' AS role_name, 'TASK_RESTORE' AS permission_code FROM dual UNION ALL
          SELECT 'ADMIN',   'RECYCLE_BIN_VIEW' FROM dual UNION ALL
          SELECT 'MANAGER', 'TASK_RESTORE'     FROM dual UNION ALL
          SELECT 'MANAGER', 'RECYCLE_BIN_VIEW' FROM dual) m
    JOIN roles r       ON r.role_name       = m.role_name
    JOIN permissions p ON p.permission_code = m.permission_code
) src
ON (rp.role_id = src.role_id AND rp.permission_id = src.permission_id)
WHEN NOT MATCHED THEN
  INSERT (role_id, permission_id) VALUES (src.role_id, src.permission_id);
COMMIT;

PROMPT == Step 6: strict verification (read-only). Any problem stops the script with an ORA-20004 error.
-- &pre_* below are the row counts captured before the changes (see the pre-check).
SET DEFINE ON
DECLARE
  v_problems VARCHAR2(4000);
  v_n        NUMBER;

  PROCEDURE problem(p_text VARCHAR2) IS
  BEGIN
    v_problems := SUBSTR(v_problems || CHR(10) || ' - ' || p_text, 1, 4000);
  END;

  FUNCTION cnt(p_sql VARCHAR2) RETURN NUMBER IS
    n NUMBER;
  BEGIN
    EXECUTE IMMEDIATE p_sql INTO n;
    RETURN n;
  END;

  PROCEDURE same(p_label VARCHAR2, p_table VARCHAR2, p_before NUMBER) IS
    n NUMBER := cnt('SELECT COUNT(*) FROM ' || p_table);
  BEGIN
    IF n <> p_before THEN
      problem('ROW COUNT CHANGED: ' || p_label || ' was ' || p_before || ', now ' || n);
    END IF;
  END;
BEGIN
  -- columns, constraints, indexes, table
  FOR r IN (SELECT 'IS_DELETED' c FROM dual UNION ALL SELECT 'DELETED_AT' FROM dual
            UNION ALL SELECT 'DELETED_BY' FROM dual) LOOP
    IF cnt('SELECT COUNT(*) FROM user_tab_columns WHERE table_name = ''TASKS'' AND column_name = '''
           || r.c || '''') = 0 THEN
      problem('MISSING COLUMN TASKS.' || r.c);
    END IF;
  END LOOP;
  FOR r IN (SELECT 'CK_TASKS_DELETED_FLAG' c FROM dual
            UNION ALL SELECT 'CK_TASKS_DELETED_CONSISTENT' FROM dual
            UNION ALL SELECT 'FK_TASKS_DELETED_BY' FROM dual
            UNION ALL SELECT 'CK_TASK_AUDIT_ACTION' FROM dual
            UNION ALL SELECT 'FK_TASK_AUDIT_ACTOR' FROM dual) LOOP
    IF cnt('SELECT COUNT(*) FROM user_constraints WHERE constraint_name = ''' || r.c || '''') = 0 THEN
      problem('MISSING CONSTRAINT ' || r.c);
    END IF;
  END LOOP;
  FOR r IN (SELECT 'IX_TASKS_DELETED' c FROM dual UNION ALL SELECT 'IX_TASKS_DELETED_BY' FROM dual
            UNION ALL SELECT 'IX_TASK_AUDIT_TASK' FROM dual
            UNION ALL SELECT 'IX_TASK_AUDIT_PROJECT' FROM dual
            UNION ALL SELECT 'IX_TASK_AUDIT_ACTOR' FROM dual) LOOP
    IF cnt('SELECT COUNT(*) FROM user_indexes WHERE index_name = ''' || r.c || '''') = 0 THEN
      problem('MISSING INDEX ' || r.c);
    END IF;
  END LOOP;
  IF cnt('SELECT COUNT(*) FROM user_tables WHERE table_name = ''TASK_AUDIT_LOG''') = 0 THEN
    problem('MISSING TABLE TASK_AUDIT_LOG');
  END IF;

  -- permissions and grants: exactly ADMIN and MANAGER hold each new permission, MEMBER neither
  FOR r IN (SELECT 'TASK_RESTORE' c FROM dual UNION ALL SELECT 'RECYCLE_BIN_VIEW' FROM dual) LOOP
    IF cnt('SELECT COUNT(*) FROM permissions WHERE permission_code = ''' || r.c || '''') <> 1 THEN
      problem('MISSING PERMISSION ' || r.c);
    ELSE
      FOR g IN (SELECT 'ADMIN' role_name, 1 expected FROM dual UNION ALL
                SELECT 'MANAGER', 1 FROM dual UNION ALL SELECT 'MEMBER', 0 FROM dual) LOOP
        v_n := cnt('SELECT COUNT(*) FROM role_permissions rp JOIN roles ro ON ro.role_id = rp.role_id '
                   || 'JOIN permissions p ON p.permission_id = rp.permission_id '
                   || 'WHERE p.permission_code = ''' || r.c || ''' AND ro.role_name = ''' || g.role_name || '''');
        IF v_n <> g.expected THEN
          problem('WRONG GRANT: ' || g.role_name || ' ' || r.c || ' has ' || v_n || ', expected ' || g.expected);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  v_n := cnt('SELECT COUNT(*) FROM permissions');
  IF v_n <> 25 THEN problem('PERMISSIONS COUNT is ' || v_n || ', expected 25'); END IF;
  v_n := cnt('SELECT COUNT(*) FROM role_permissions');
  IF v_n <> 56 THEN problem('ROLE_PERMISSIONS COUNT is ' || v_n || ', expected 56'); END IF;

  -- packages: must exist, be VALID, and be the soft-delete version (bodies mention is_deleted)
  FOR r IN (SELECT 'PKG_DASHBOARD' c FROM dual UNION ALL SELECT 'PKG_NOTIFICATION' FROM dual) LOOP
    IF cnt('SELECT COUNT(*) FROM user_objects WHERE object_type = ''PACKAGE BODY'' AND status = ''VALID'' '
           || 'AND object_name = ''' || r.c || '''') <> 1 THEN
      problem('PACKAGE BODY ' || r.c || ' is missing or INVALID');
    ELSIF cnt('SELECT COUNT(*) FROM user_source WHERE type = ''PACKAGE BODY'' AND name = ''' || r.c
              || ''' AND LOWER(text) LIKE ''%is_deleted%''') = 0 THEN
      problem('PACKAGE BODY ' || r.c || ' is the OLD version (no is_deleted filter): run '
              || 'plsql/run_all.sql from the plsql directory, then run this script again');
    END IF;
  END LOOP;

  -- nothing existing was changed
  same('tasks',          'tasks',          &pre_tasks);
  same('subtasks',       'subtasks',       &pre_sub);
  same('comments',       'comments',       &pre_com);
  same('attachments',    'attachments',    &pre_att);
  same('task_assignees', 'task_assignees', &pre_asg);

  IF v_problems IS NOT NULL THEN
    RAISE_APPLICATION_ERROR(-20004, 'Migration 004 verification FAILED:' || v_problems);
  END IF;
  DBMS_OUTPUT.PUT_LINE('Migration 004 verified: columns, constraints, indexes, audit table, '
                    || '25 permissions / 56 grants, both packages VALID and current, row counts unchanged.');
END;
/
SET DEFINE OFF

PROMPT ================================================
PROMPT  Migration 004 verified (a failure above would have stopped the script). Safe to run again.
PROMPT ================================================
