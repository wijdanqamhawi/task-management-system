-- T022 — Immutable reference data. The system will not function without these rows.
SET DEFINE OFF

-- FR-008 [CLARIFIED]: exactly three roles.
INSERT INTO roles (role_name, description) VALUES ('ADMIN',   'Manages users, roles, and account activation');
INSERT INTO roles (role_name, description) VALUES ('MANAGER', 'Creates and manages projects, assigns members and tasks');
INSERT INTO roles (role_name, description) VALUES ('MEMBER',  'Works on assigned tasks, updates status, comments');

-- FR-027 / Constitution VI: exactly four statuses, in workflow order.
INSERT INTO task_status (status_code, sort_order) VALUES ('TO_DO',       1);
INSERT INTO task_status (status_code, sort_order) VALUES ('IN_PROGRESS', 2);
INSERT INTO task_status (status_code, sort_order) VALUES ('REVIEW',      3);
INSERT INTO task_status (status_code, sort_order) VALUES ('COMPLETED',   4);

-- [PLAN]: fixed ordered priority set (data-model.md).
INSERT INTO task_priority (priority_code, sort_order) VALUES ('LOW',    1);
INSERT INTO task_priority (priority_code, sort_order) VALUES ('MEDIUM', 2);
INSERT INTO task_priority (priority_code, sort_order) VALUES ('HIGH',   3);

COMMIT;

-- Verification required by quickstart.md § First-time setup.
PROMPT Reference data loaded. Expect 3 roles, 4 statuses, 3 priorities:
SELECT 'roles'      AS table_name, COUNT(*) AS row_count FROM roles
UNION ALL SELECT 'task_status',   COUNT(*) FROM task_status
UNION ALL SELECT 'task_priority', COUNT(*) FROM task_priority;
