-- T108 - PKG_DASHBOARD body. FR-036..FR-045, research.md R-006.
--
-- Implements the specification in pkg_dashboard.pks. Visibility (R-004) is applied INSIDE every
-- query: a user sees a project/task if they are a member of the project or hold ADMIN.
-- "Overdue" = due_date earlier than today and status not COMPLETED. "Pending" = not COMPLETED.
-- This file only defines package code; it does not touch any table or the schema.

CREATE OR REPLACE PACKAGE BODY pkg_dashboard AS

  PROCEDURE get_totals (
    p_user_id         IN  NUMBER,
    p_total_projects  OUT NUMBER,
    p_total_tasks     OUT NUMBER,
    p_completed_tasks OUT NUMBER,
    p_pending_tasks   OUT NUMBER,
    p_overdue_tasks   OUT NUMBER
  ) IS
  BEGIN
    SELECT COUNT(*)
      INTO p_total_projects
      FROM projects p
     WHERE EXISTS (SELECT 1 FROM users u JOIN roles r ON r.role_id = u.role_id
                    WHERE u.user_id = p_user_id AND r.role_name = 'ADMIN')
        OR EXISTS (SELECT 1 FROM project_members pm
                    WHERE pm.project_id = p.project_id AND pm.user_id = p_user_id);

    SELECT COUNT(t.task_id),
           NVL(SUM(CASE WHEN s.status_code = 'COMPLETED' THEN 1 ELSE 0 END), 0),
           NVL(SUM(CASE WHEN s.status_code <> 'COMPLETED' THEN 1 ELSE 0 END), 0),
           NVL(SUM(CASE WHEN s.status_code <> 'COMPLETED'
                         AND t.due_date IS NOT NULL
                         AND t.due_date < TRUNC(SYSDATE) THEN 1 ELSE 0 END), 0)
      INTO p_total_tasks, p_completed_tasks, p_pending_tasks, p_overdue_tasks
      FROM tasks t
      JOIN task_status s ON s.status_id = t.status_id
     WHERE EXISTS (SELECT 1 FROM users u JOIN roles r ON r.role_id = u.role_id
                    WHERE u.user_id = p_user_id AND r.role_name = 'ADMIN')
        OR EXISTS (SELECT 1 FROM project_members pm
                    WHERE pm.project_id = t.project_id AND pm.user_id = p_user_id);
  END get_totals;

  FUNCTION tasks_by_status (p_user_id IN NUMBER) RETURN SYS_REFCURSOR IS
    c SYS_REFCURSOR;
  BEGIN
    OPEN c FOR
      SELECT s.status_code, COUNT(t.task_id) AS task_count
        FROM task_status s
        LEFT JOIN tasks t
          ON t.status_id = s.status_id
         AND (EXISTS (SELECT 1 FROM users u JOIN roles r ON r.role_id = u.role_id
                       WHERE u.user_id = p_user_id AND r.role_name = 'ADMIN')
              OR EXISTS (SELECT 1 FROM project_members pm
                          WHERE pm.project_id = t.project_id AND pm.user_id = p_user_id))
       GROUP BY s.status_code, s.sort_order
       ORDER BY s.sort_order;
    RETURN c;
  END tasks_by_status;

  FUNCTION tasks_by_priority (p_user_id IN NUMBER) RETURN SYS_REFCURSOR IS
    c SYS_REFCURSOR;
  BEGIN
    OPEN c FOR
      SELECT pr.priority_code, COUNT(t.task_id) AS task_count
        FROM task_priority pr
        LEFT JOIN tasks t
          ON t.priority_id = pr.priority_id
         AND (EXISTS (SELECT 1 FROM users u JOIN roles r ON r.role_id = u.role_id
                       WHERE u.user_id = p_user_id AND r.role_name = 'ADMIN')
              OR EXISTS (SELECT 1 FROM project_members pm
                          WHERE pm.project_id = t.project_id AND pm.user_id = p_user_id))
       GROUP BY pr.priority_code, pr.sort_order
       ORDER BY pr.sort_order;
    RETURN c;
  END tasks_by_priority;

  FUNCTION tasks_by_user (p_user_id IN NUMBER) RETURN SYS_REFCURSOR IS
    c SYS_REFCURSOR;
  BEGIN
    OPEN c FOR
      SELECT u.user_id, u.full_name, COUNT(*) AS task_count
        FROM task_assignees ta
        JOIN tasks t ON t.task_id = ta.task_id
        JOIN users u ON u.user_id = ta.user_id
       WHERE EXISTS (SELECT 1 FROM users a JOIN roles r ON r.role_id = a.role_id
                      WHERE a.user_id = p_user_id AND r.role_name = 'ADMIN')
          OR EXISTS (SELECT 1 FROM project_members pm
                      WHERE pm.project_id = t.project_id AND pm.user_id = p_user_id)
       GROUP BY u.user_id, u.full_name
       ORDER BY task_count DESC, u.full_name;
    RETURN c;
  END tasks_by_user;

  FUNCTION project_progress (p_user_id IN NUMBER) RETURN SYS_REFCURSOR IS
    c SYS_REFCURSOR;
  BEGIN
    OPEN c FOR
      SELECT p.project_id, p.name,
             COUNT(t.task_id) AS total_tasks,
             NVL(SUM(CASE WHEN s.status_code = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_tasks,
             CASE WHEN COUNT(t.task_id) = 0 THEN 0
                  ELSE ROUND(100 * SUM(CASE WHEN s.status_code = 'COMPLETED' THEN 1 ELSE 0 END)
                             / COUNT(t.task_id)) END AS percent_complete
        FROM projects p
        LEFT JOIN tasks t       ON t.project_id = p.project_id
        LEFT JOIN task_status s ON s.status_id  = t.status_id
       WHERE EXISTS (SELECT 1 FROM users u JOIN roles r ON r.role_id = u.role_id
                      WHERE u.user_id = p_user_id AND r.role_name = 'ADMIN')
          OR EXISTS (SELECT 1 FROM project_members pm
                      WHERE pm.project_id = p.project_id AND pm.user_id = p_user_id)
       GROUP BY p.project_id, p.name
       ORDER BY p.name;
    RETURN c;
  END project_progress;

  FUNCTION project_progress_one (p_user_id IN NUMBER, p_project_id IN NUMBER)
    RETURN SYS_REFCURSOR IS
    c SYS_REFCURSOR;
  BEGIN
    OPEN c FOR
      SELECT p.project_id, p.name,
             COUNT(t.task_id) AS total_tasks,
             NVL(SUM(CASE WHEN s.status_code = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_tasks,
             CASE WHEN COUNT(t.task_id) = 0 THEN 0
                  ELSE ROUND(100 * SUM(CASE WHEN s.status_code = 'COMPLETED' THEN 1 ELSE 0 END)
                             / COUNT(t.task_id)) END AS percent_complete
        FROM projects p
        LEFT JOIN tasks t       ON t.project_id = p.project_id
        LEFT JOIN task_status s ON s.status_id  = t.status_id
       WHERE p.project_id = p_project_id
         AND (EXISTS (SELECT 1 FROM users u JOIN roles r ON r.role_id = u.role_id
                       WHERE u.user_id = p_user_id AND r.role_name = 'ADMIN')
              OR EXISTS (SELECT 1 FROM project_members pm
                          WHERE pm.project_id = p.project_id AND pm.user_id = p_user_id))
       GROUP BY p.project_id, p.name;
    RETURN c;
  END project_progress_one;

END pkg_dashboard;
/
