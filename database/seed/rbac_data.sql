-- RBAC Phase 1 - permission catalogue and role -> permission grants.
--
-- Idempotent and additive: every statement is a MERGE ... WHEN NOT MATCHED THEN INSERT. It never
-- updates, deletes or truncates, so it is safe to run on a populated database, any number of
-- times. A row someone removed on purpose is re-added by a re-run; a grant added by hand is left
-- alone. Requires the ROLES rows (reference_data.sql) and the tables from ddl/09_rbac.sql.
--
-- Included by seed/reference_data.sql (fresh install) and by migrations/001_rbac_permissions.sql
-- (existing database), so there is one source of truth for the mapping.
--
-- SCOPE: a permission is a GLOBAL capability held through the role. It never replaces the
-- resource-level rules, which stay in the application (access.py / tasks.service):
--   project membership   - project_members; a project/task is visible only to its members
--   project manager      - a MANAGER manages a project only if they are a member of it
--   assignee             - task_assignees; an assignee may change that task's status
--   creator / uploader   - tasks.created_by, attachments.uploaded_by (the *_OWN permissions)
-- The *_ALL permissions are the ADMIN bypass of the membership rule.
-- A permission answers "may this role ever do X?"; the resource rule answers "on THIS row?".
SET DEFINE OFF

-- ------------------------------------------------------------------ permissions
MERGE INTO permissions p
USING (
  SELECT 'USER_ROLE_ASSIGN' AS permission_code, 'Change another user''s role (PUT /users/{id}/role); the Users admin screen' AS description FROM dual UNION ALL
  SELECT 'USER_STATUS_MANAGE',    'Activate or deactivate user accounts'                                  FROM dual UNION ALL
  SELECT 'PROJECT_VIEW',          'View projects the user is a member of'                                 FROM dual UNION ALL
  SELECT 'PROJECT_VIEW_ALL',      'View every project and task regardless of membership (ADMIN bypass)'   FROM dual UNION ALL
  SELECT 'PROJECT_CREATE',        'Create a project; the creator becomes its first member'                FROM dual UNION ALL
  SELECT 'PROJECT_UPDATE',        'Edit a project; MANAGER only on projects they belong to'               FROM dual UNION ALL
  SELECT 'PROJECT_DELETE',        'Delete a project; MANAGER only on projects they belong to'             FROM dual UNION ALL
  SELECT 'PROJECT_MEMBER_MANAGE', 'Add and remove project members; MANAGER only on their own projects'    FROM dual UNION ALL
  SELECT 'PROJECT_MANAGE_ALL',    'Act as manager of every project regardless of membership (ADMIN bypass)' FROM dual UNION ALL
  SELECT 'TASK_VIEW',             'View tasks, comments, subtasks and attachments of visible projects'    FROM dual UNION ALL
  SELECT 'TASK_CREATE',           'Create a task in a project the user can see'                           FROM dual UNION ALL
  SELECT 'TASK_EDIT',             'Edit task details; project managers only'                              FROM dual UNION ALL
  SELECT 'TASK_ASSIGN',           'Assign and unassign task assignees; project managers only'             FROM dual UNION ALL
  SELECT 'TASK_STATUS_CHANGE',    'Change task status; assignees, project managers and ADMIN'             FROM dual UNION ALL
  SELECT 'TASK_DELETE_ANY',       'Delete any task of a project the user manages'                         FROM dual UNION ALL
  SELECT 'TASK_DELETE_OWN',       'Delete a task the user created'                                        FROM dual UNION ALL
  SELECT 'COMMENT_CREATE',        'Comment on a visible task'                                             FROM dual UNION ALL
  SELECT 'SUBTASK_MANAGE',        'Add, edit and delete subtasks of a visible task'                       FROM dual UNION ALL
  SELECT 'ATTACHMENT_UPLOAD',     'Upload attachments to a visible task'                                  FROM dual UNION ALL
  SELECT 'ATTACHMENT_DELETE_ANY', 'Delete any attachment on a project the user manages'                   FROM dual UNION ALL
  SELECT 'ATTACHMENT_DELETE_OWN', 'Delete an attachment the user uploaded'                                FROM dual
) src
ON (p.permission_code = src.permission_code)
WHEN NOT MATCHED THEN
  INSERT (permission_code, description) VALUES (src.permission_code, src.description);

-- ------------------------------------------------------------------ role_permissions
-- ADMIN: everything (21). Listed explicitly so a permission added later is not granted silently.
-- MANAGER: project and task management, but no user administration and no *_ALL bypass (17).
-- MEMBER: work on tasks of projects they belong to (9).
MERGE INTO role_permissions rp
USING (
  SELECT r.role_id, p.permission_id
    FROM (
      SELECT 'ADMIN' AS role_name, 'USER_ROLE_ASSIGN' AS permission_code FROM dual UNION ALL
      SELECT 'ADMIN', 'USER_STATUS_MANAGE'    FROM dual UNION ALL
      SELECT 'ADMIN', 'PROJECT_VIEW'          FROM dual UNION ALL
      SELECT 'ADMIN', 'PROJECT_VIEW_ALL'      FROM dual UNION ALL
      SELECT 'ADMIN', 'PROJECT_CREATE'        FROM dual UNION ALL
      SELECT 'ADMIN', 'PROJECT_UPDATE'        FROM dual UNION ALL
      SELECT 'ADMIN', 'PROJECT_DELETE'        FROM dual UNION ALL
      SELECT 'ADMIN', 'PROJECT_MEMBER_MANAGE' FROM dual UNION ALL
      SELECT 'ADMIN', 'PROJECT_MANAGE_ALL'    FROM dual UNION ALL
      SELECT 'ADMIN', 'TASK_VIEW'             FROM dual UNION ALL
      SELECT 'ADMIN', 'TASK_CREATE'           FROM dual UNION ALL
      SELECT 'ADMIN', 'TASK_EDIT'             FROM dual UNION ALL
      SELECT 'ADMIN', 'TASK_ASSIGN'           FROM dual UNION ALL
      SELECT 'ADMIN', 'TASK_STATUS_CHANGE'    FROM dual UNION ALL
      SELECT 'ADMIN', 'TASK_DELETE_ANY'       FROM dual UNION ALL
      SELECT 'ADMIN', 'TASK_DELETE_OWN'       FROM dual UNION ALL
      SELECT 'ADMIN', 'COMMENT_CREATE'        FROM dual UNION ALL
      SELECT 'ADMIN', 'SUBTASK_MANAGE'        FROM dual UNION ALL
      SELECT 'ADMIN', 'ATTACHMENT_UPLOAD'     FROM dual UNION ALL
      SELECT 'ADMIN', 'ATTACHMENT_DELETE_ANY' FROM dual UNION ALL
      SELECT 'ADMIN', 'ATTACHMENT_DELETE_OWN' FROM dual UNION ALL
      SELECT 'MANAGER', 'PROJECT_VIEW'          FROM dual UNION ALL
      SELECT 'MANAGER', 'PROJECT_CREATE'        FROM dual UNION ALL
      SELECT 'MANAGER', 'PROJECT_UPDATE'        FROM dual UNION ALL
      SELECT 'MANAGER', 'PROJECT_DELETE'        FROM dual UNION ALL
      SELECT 'MANAGER', 'PROJECT_MEMBER_MANAGE' FROM dual UNION ALL
      SELECT 'MANAGER', 'TASK_VIEW'             FROM dual UNION ALL
      SELECT 'MANAGER', 'TASK_CREATE'           FROM dual UNION ALL
      SELECT 'MANAGER', 'TASK_EDIT'             FROM dual UNION ALL
      SELECT 'MANAGER', 'TASK_ASSIGN'           FROM dual UNION ALL
      SELECT 'MANAGER', 'TASK_STATUS_CHANGE'    FROM dual UNION ALL
      SELECT 'MANAGER', 'TASK_DELETE_ANY'       FROM dual UNION ALL
      SELECT 'MANAGER', 'TASK_DELETE_OWN'       FROM dual UNION ALL
      SELECT 'MANAGER', 'COMMENT_CREATE'        FROM dual UNION ALL
      SELECT 'MANAGER', 'SUBTASK_MANAGE'        FROM dual UNION ALL
      SELECT 'MANAGER', 'ATTACHMENT_UPLOAD'     FROM dual UNION ALL
      SELECT 'MANAGER', 'ATTACHMENT_DELETE_ANY' FROM dual UNION ALL
      SELECT 'MANAGER', 'ATTACHMENT_DELETE_OWN' FROM dual UNION ALL
      SELECT 'MEMBER', 'PROJECT_VIEW'          FROM dual UNION ALL
      SELECT 'MEMBER', 'TASK_VIEW'             FROM dual UNION ALL
      SELECT 'MEMBER', 'TASK_CREATE'           FROM dual UNION ALL
      SELECT 'MEMBER', 'TASK_STATUS_CHANGE'    FROM dual UNION ALL
      SELECT 'MEMBER', 'TASK_DELETE_OWN'       FROM dual UNION ALL
      SELECT 'MEMBER', 'COMMENT_CREATE'        FROM dual UNION ALL
      SELECT 'MEMBER', 'SUBTASK_MANAGE'        FROM dual UNION ALL
      SELECT 'MEMBER', 'ATTACHMENT_UPLOAD'     FROM dual UNION ALL
      SELECT 'MEMBER', 'ATTACHMENT_DELETE_OWN' FROM dual
    ) m
    JOIN roles r       ON r.role_name       = m.role_name
    JOIN permissions p ON p.permission_code = m.permission_code
) src
ON (rp.role_id = src.role_id AND rp.permission_id = src.permission_id)
WHEN NOT MATCHED THEN
  INSERT (role_id, permission_id) VALUES (src.role_id, src.permission_id);

COMMIT;

PROMPT RBAC data loaded. Expect 21 permissions and 47 role_permissions (ADMIN 21, MANAGER 17, MEMBER 9):
SELECT r.role_name, COUNT(rp.permission_id) AS permission_count
  FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
 GROUP BY r.role_name ORDER BY r.role_name;
