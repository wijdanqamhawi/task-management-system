-- T023 — Demo dataset.
--
-- The fixture that SC-005 (dashboard accuracy) and SC-012 (notification correctness) are
-- validated against. Deterministic: the same script always produces the same figures, so
-- expected dashboard values can be computed and compared exactly.
--
-- Contents: 1 Admin, 2 Managers, 4 Members, 3 projects, 40 tasks spanning every status,
-- every priority, single and multiple assignees, and a set of past due dates.
--
-- All demo users share the password  Password1!
-- The hash below is a real BCrypt hash of that password, generated with Spring Security's
-- BCryptPasswordEncoder and verified. It is DEMO DATA ONLY — never use it outside a local
-- development schema.
--
-- Prerequisite: reference_data.sql must have been run first.
-- Usage: sqlplus tms_user/<password>@//localhost:1521/FREEPDB1 @demo_data.sql

SET DEFINE OFF
SET SERVEROUTPUT ON

-- Clear any previous demo run so this script is repeatable.
DELETE FROM notifications;
DELETE FROM attachments;
DELETE FROM comments;
DELETE FROM subtasks;
DELETE FROM task_assignees;
DELETE FROM tasks;
DELETE FROM project_members;
DELETE FROM projects;
DELETE FROM users;
COMMIT;

-- ---------------------------------------------------------------------------
-- Users: 1 Admin, 2 Managers, 4 Members  (FR-001, FR-004)
-- ---------------------------------------------------------------------------
INSERT INTO users (username, email, password_hash, full_name, role_id, is_active)
SELECT 'admin', 'admin@example.org',
       '$2a$10$V0MBuKWF.bL1KY91ELHnGu8gLHuKl.HfBJG3EAGgd7qzgCeG1xU7S',
       'System Administrator', role_id, 'Y' FROM roles WHERE role_name = 'ADMIN';

INSERT INTO users (username, email, password_hash, full_name, role_id, is_active)
SELECT 'm.saleh', 'm.saleh@example.org',
       '$2a$10$V0MBuKWF.bL1KY91ELHnGu8gLHuKl.HfBJG3EAGgd7qzgCeG1xU7S',
       'M. Saleh', role_id, 'Y' FROM roles WHERE role_name = 'MANAGER';

INSERT INTO users (username, email, password_hash, full_name, role_id, is_active)
SELECT 'n.darwish', 'n.darwish@example.org',
       '$2a$10$V0MBuKWF.bL1KY91ELHnGu8gLHuKl.HfBJG3EAGgd7qzgCeG1xU7S',
       'N. Darwish', role_id, 'Y' FROM roles WHERE role_name = 'MANAGER';

INSERT INTO users (username, email, password_hash, full_name, role_id, is_active)
SELECT 'a.hassan', 'a.hassan@example.org',
       '$2a$10$V0MBuKWF.bL1KY91ELHnGu8gLHuKl.HfBJG3EAGgd7qzgCeG1xU7S',
       'A. Hassan', role_id, 'Y' FROM roles WHERE role_name = 'MEMBER';

INSERT INTO users (username, email, password_hash, full_name, role_id, is_active)
SELECT 'r.odeh', 'r.odeh@example.org',
       '$2a$10$V0MBuKWF.bL1KY91ELHnGu8gLHuKl.HfBJG3EAGgd7qzgCeG1xU7S',
       'R. Odeh', role_id, 'Y' FROM roles WHERE role_name = 'MEMBER';

INSERT INTO users (username, email, password_hash, full_name, role_id, is_active)
SELECT 's.khalil', 's.khalil@example.org',
       '$2a$10$V0MBuKWF.bL1KY91ELHnGu8gLHuKl.HfBJG3EAGgd7qzgCeG1xU7S',
       'S. Khalil', role_id, 'Y' FROM roles WHERE role_name = 'MEMBER';

-- One INACTIVE member, so FR-007 and FR-061 have a fixture.
INSERT INTO users (username, email, password_hash, full_name, role_id, is_active)
SELECT 'y.nasser', 'y.nasser@example.org',
       '$2a$10$V0MBuKWF.bL1KY91ELHnGu8gLHuKl.HfBJG3EAGgd7qzgCeG1xU7S',
       'Y. Nasser (deactivated)', role_id, 'N' FROM roles WHERE role_name = 'MEMBER';
COMMIT;

-- ---------------------------------------------------------------------------
-- Projects and membership  (FR-009 .. FR-015)
-- ---------------------------------------------------------------------------
INSERT INTO projects (name, description, status, start_date, end_date, created_by)
SELECT 'Payroll Migration', 'Migrate payroll tables to the new schema.',
       'ACTIVE', DATE '2026-09-01', DATE '2026-12-15', user_id
  FROM users WHERE username = 'm.saleh';

INSERT INTO projects (name, description, status, start_date, end_date, created_by)
SELECT 'Helpdesk Portal', 'Internal helpdesk request portal.',
       'ACTIVE', DATE '2026-08-15', DATE '2026-11-30', user_id
  FROM users WHERE username = 'm.saleh';

INSERT INTO projects (name, description, status, start_date, end_date, created_by)
SELECT 'Network Audit', 'Department-wide network inventory and audit.',
       'PLANNED', DATE '2026-10-01', DATE '2027-01-31', user_id
  FROM users WHERE username = 'n.darwish';
COMMIT;

-- Membership. a.hassan and r.odeh are in projects 1 and 2; s.khalil only in project 3.
-- This asymmetry is what FR-045 and FR-053 visibility scoping are tested against.
INSERT INTO project_members (project_id, user_id)
SELECT p.project_id, u.user_id FROM projects p, users u
 WHERE p.name = 'Payroll Migration' AND u.username IN ('m.saleh','a.hassan','r.odeh');

INSERT INTO project_members (project_id, user_id)
SELECT p.project_id, u.user_id FROM projects p, users u
 WHERE p.name = 'Helpdesk Portal' AND u.username IN ('m.saleh','a.hassan','r.odeh');

INSERT INTO project_members (project_id, user_id)
SELECT p.project_id, u.user_id FROM projects p, users u
 WHERE p.name = 'Network Audit' AND u.username IN ('n.darwish','s.khalil');
COMMIT;

-- ---------------------------------------------------------------------------
-- 40 tasks, deterministically distributed.
--
--   status   : cycles TO_DO, IN_PROGRESS, REVIEW, COMPLETED  -> 10 of each
--   priority : cycles LOW, MEDIUM, HIGH                      -> 14/13/13
--   project  : cycles the three projects
--   due_date : every 3rd task is in the past. The period 3 is coprime with the
--              status period 4, so past-due tasks spread across all four statuses
--              instead of correlating with COMPLETED. This yields a NON-ZERO
--              overdue count, which FR-040 and SC-005 need as a fixture.
-- ---------------------------------------------------------------------------
DECLARE
  TYPE t_ids IS TABLE OF NUMBER;
  v_status   t_ids;
  v_priority t_ids;
  v_project  t_ids;
  v_creator  NUMBER;
  v_due      DATE;
  v_task     NUMBER;
  -- Scalars: a locally declared collection cannot be indexed inside a SQL
  -- statement (PLS-00425), so each element is copied out before the INSERT.
  v_pid      NUMBER;
  v_sid      NUMBER;
  v_prid     NUMBER;
BEGIN
  SELECT status_id   BULK COLLECT INTO v_status   FROM task_status   ORDER BY sort_order;
  SELECT priority_id BULK COLLECT INTO v_priority FROM task_priority ORDER BY sort_order;
  SELECT project_id  BULK COLLECT INTO v_project  FROM projects      ORDER BY project_id;
  SELECT user_id INTO v_creator FROM users WHERE username = 'm.saleh';

  FOR i IN 1 .. 40 LOOP
    -- Every 3rd task is already past its due date (period coprime with status).
    v_due := CASE WHEN MOD(i, 3) = 0 THEN TRUNC(SYSDATE) - 5 ELSE TRUNC(SYSDATE) + 20 END;

    v_pid  := v_project(MOD(i - 1, v_project.COUNT) + 1);
    v_sid  := v_status(MOD(i - 1, v_status.COUNT) + 1);
    v_prid := v_priority(MOD(i - 1, v_priority.COUNT) + 1);

    INSERT INTO tasks (project_id, title, description, status_id, priority_id,
                       start_date, due_date, created_by)
    VALUES (v_pid,
            'Demo task ' || LPAD(i, 2, '0'),
            'Seeded demo task number ' || i || '.',
            v_sid,
            v_prid,
            TRUNC(SYSDATE) - 10, v_due, v_creator)
    RETURNING task_id INTO v_task;

    -- Assignment: every task gets one assignee; every 5th gets a second,
    -- so FR-019 (one or more users) has a fixture in both shapes.
    INSERT INTO task_assignees (task_id, user_id, assigned_by)
    SELECT v_task, user_id, v_creator FROM users
     WHERE username = CASE MOD(i, 3) WHEN 0 THEN 'a.hassan'
                                     WHEN 1 THEN 'r.odeh'
                                     ELSE 's.khalil' END;

    IF MOD(i, 5) = 0 THEN
      INSERT INTO task_assignees (task_id, user_id, assigned_by)
      SELECT v_task, user_id, v_creator FROM users WHERE username = 'a.hassan'
         AND NOT EXISTS (SELECT 1 FROM task_assignees ta
                          WHERE ta.task_id = v_task AND ta.user_id = users.user_id);
    END IF;

    -- A few tasks carry subtasks and comments so US5 has data to demonstrate.
    IF MOD(i, 7) = 0 THEN
      INSERT INTO subtasks (task_id, title, is_completed, sort_order)
      VALUES (v_task, 'Subtask A for task ' || i, 'Y', 1);
      INSERT INTO subtasks (task_id, title, is_completed, sort_order)
      VALUES (v_task, 'Subtask B for task ' || i, 'N', 2);

      INSERT INTO comments (task_id, user_id, body)
      VALUES (v_task, v_creator, 'Seeded comment on task ' || i || '.');
    END IF;
  END LOOP;
  COMMIT;
  DBMS_OUTPUT.PUT_LINE('Demo data loaded.');
END;
/

-- ---------------------------------------------------------------------------
-- Expected dashboard figures. T113 compares GET /api/dashboard against these.
-- ---------------------------------------------------------------------------
PROMPT
PROMPT ===== Expected dashboard figures (admin scope, FR-036..FR-044) =====
SELECT 'total_projects'  AS figure, TO_CHAR(COUNT(*)) AS value FROM projects
UNION ALL
SELECT 'total_tasks',     TO_CHAR(COUNT(*)) FROM tasks
UNION ALL
SELECT 'completed_tasks', TO_CHAR(COUNT(*)) FROM tasks t JOIN task_status s ON s.status_id = t.status_id
 WHERE s.status_code = 'COMPLETED'
UNION ALL
SELECT 'pending_tasks',   TO_CHAR(COUNT(*)) FROM tasks t JOIN task_status s ON s.status_id = t.status_id
 WHERE s.status_code <> 'COMPLETED'
UNION ALL
SELECT 'overdue_tasks',   TO_CHAR(COUNT(*)) FROM tasks t JOIN task_status s ON s.status_id = t.status_id
 WHERE s.status_code <> 'COMPLETED' AND t.due_date < TRUNC(SYSDATE);

PROMPT
PROMPT ===== Tasks by status (FR-041) =====
SELECT s.status_code, COUNT(*) AS task_count
  FROM tasks t JOIN task_status s ON s.status_id = t.status_id
 GROUP BY s.status_code, s.sort_order ORDER BY s.sort_order;

PROMPT
PROMPT ===== Tasks by priority (FR-042) =====
SELECT p.priority_code, COUNT(*) AS task_count
  FROM tasks t JOIN task_priority p ON p.priority_id = t.priority_id
 GROUP BY p.priority_code, p.sort_order ORDER BY p.sort_order;

PROMPT
PROMPT ===== Tasks per user (FR-043) =====
SELECT u.username, COUNT(*) AS task_count
  FROM task_assignees ta JOIN users u ON u.user_id = ta.user_id
 GROUP BY u.username ORDER BY u.username;
